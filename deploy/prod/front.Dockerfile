FROM node:22 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 HUSKY=0 CI=1
RUN npm install -g pnpm@10 --no-fund --no-audit
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --no-frozen-lockfile
COPY . .
# Same-origin API: the proxy sends /api/v1/* and /token/* to Django, so the
# bundle works on both http://<ip>:8097 and https://lottery.bordino.co.
ENV NEXT_PUBLIC_API_BASE_URL=/api/v1/ \
    NEXT_PUBLIC_REFRESH_URL=/
RUN pnpm exec next build --no-lint && rm -rf .next/cache
# Every script/stylesheet also saved compressed (brotli + gzip) once, here: the lottery proxy hands
# these out from disk (deploy/data/next, file_server precompressed), so no request makes Next
# compress them again. Next itself ignores the extra files.
RUN node -e 'const fs=require("fs"),path=require("path"),zlib=require("zlib");const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);let n=0;for(const f of walk(".next/static")){if(!/\.(js|css|svg|json|txt)$/.test(f))continue;const b=fs.readFileSync(f);if(b.length<1024)continue;fs.writeFileSync(f+".gz",zlib.gzipSync(b,{level:9}));fs.writeFileSync(f+".br",zlib.brotliCompressSync(b,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:11}}));n++}console.log("precompressed",n,"files")'

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
