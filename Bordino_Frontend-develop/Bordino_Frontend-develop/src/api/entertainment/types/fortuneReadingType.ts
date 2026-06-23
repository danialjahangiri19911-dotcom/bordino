export interface FortuneReadingData {
	type: "hafez";
	question: string; // عنوان غزل مثل «غزل ۷۱»
	result: string;   // مصراع‌ها + \n===\n + تفسیر
	audio_url: string | null;
}

/** شکل واقعی response از API — همه endpoint ها در این wrapper می‌آیند */
export interface FortuneReading {
	is_successful: boolean;
	status_code: number;
	result: FortuneReadingData;
	errors: string[] | null;
}

/** مصراع‌ها را به دو ستون راست/چپ تقسیم می‌کند */
export function parseHafezResult(result: string | undefined | null): {
	rightCol: string[];
	leftCol: string[];
	interpretation: string;
} {
	const [poemPart = "", interpretation = ""] = (result ?? "").split("\n===\n");
	const lines = poemPart.split("\n").filter((l) => l.trim());
	const rightCol: string[] = [];
	const leftCol: string[] = [];
	lines.forEach((line, i) => {
		if (i % 2 === 0) rightCol.push(line);
		else leftCol.push(line);
	});
	return { rightCol, leftCol, interpretation: interpretation.trim() };
}
