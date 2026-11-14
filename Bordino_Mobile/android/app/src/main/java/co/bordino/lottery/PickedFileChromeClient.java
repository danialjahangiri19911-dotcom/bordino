package co.bordino.lottery;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.util.Log;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * A file chosen in a page (<input type=file>: the profile photo, a mission photo) reaches the page as a COPY
 * in the app's own cache (2026-11-14).
 *
 * Why: on Android 13 (Samsung S20 FE, traced) the gallery hands back a content:// reference whose read grant
 * belongs to this activity only; the WebView then saw the file's name and size but every read failed with
 * NotReadableError («permission problems»), so a valid JPG or PNG could never be opened. The copy is made
 * here, at once, while the grant is still valid, and handed over through this app's FileProvider, which the
 * WebView can always read. Everything else (the picker, the camera) stays Capacitor's own.
 */
public class PickedFileChromeClient extends BridgeWebChromeClient {

    private static final String TAG = "BordinoPicker";
    private static final long MAX_BYTES = 80L * 1024 * 1024;
    private final Bridge bridge;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());

    public PickedFileChromeClient(Bridge bridge) {
        super(bridge);
        this.bridge = bridge;
    }

    @Override
    public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams params) {
        ValueCallback<Uri[]> copying = (uris) -> {
            if (uris == null || uris.length == 0) {
                filePathCallback.onReceiveValue(uris);
                return;
            }
            // (copied off the main thread; the page gets the files when they are ready)
            io.execute(() -> {
                Uri[] copies = new Uri[uris.length];
                for (int i = 0; i < uris.length; i++) copies[i] = copyToCache(uris[i]);
                main.post(() -> filePathCallback.onReceiveValue(copies));
            });
        };
        return super.onShowFileChooser(webView, copying, params);
    }

    /** The picked file copied into cache/picked/ and shared through the FileProvider; the original if that fails. */
    private Uri copyToCache(Uri source) {
        String authority = bridge.getContext().getPackageName() + ".fileprovider";
        if (source == null || authority.equals(source.getAuthority())) return source; // (already ours: the camera)
        ContentResolver resolver = bridge.getContext().getContentResolver();
        String name = displayName(resolver, source);
        File dir = new File(bridge.getContext().getCacheDir(), "picked");
        if (!dir.exists() && !dir.mkdirs()) return source;
        cleanOld(dir);
        File target = new File(dir, UUID.randomUUID().toString().substring(0, 8) + "-" + name);
        try (InputStream in = resolver.openInputStream(source); OutputStream out = new FileOutputStream(target)) {
            if (in == null) return source;
            byte[] buffer = new byte[64 * 1024];
            long total = 0;
            int n;
            while ((n = in.read(buffer)) != -1) {
                total += n;
                if (total > MAX_BYTES) throw new java.io.IOException("too big");
                out.write(buffer, 0, n);
            }
            return FileProvider.getUriForFile(bridge.getContext(), authority, target);
        } catch (Exception e) {
            Log.w(TAG, "could not copy the picked file: " + e);
            //noinspection ResultOfMethodCallIgnored
            target.delete();
            return source; // (the page then reports what it could not read)
        }
    }

    private static String displayName(ContentResolver resolver, Uri uri) {
        String name = null;
        try (Cursor c = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) name = c.getString(0);
        } catch (Exception ignored) {
            // no name: a neutral one below
        }
        if (name == null || name.isEmpty()) name = "picked";
        return name.replaceAll("[^A-Za-z0-9._-]", "_");
    }

    /** Copies older than a day go (each photo is read once, right after it is picked). */
    private static void cleanOld(File dir) {
        File[] files = dir.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        for (File f : files) {
            //noinspection ResultOfMethodCallIgnored
            if (f.lastModified() < cutoff) f.delete();
        }
    }
}
