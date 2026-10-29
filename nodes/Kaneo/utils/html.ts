const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	nbsp: ' ',
};

function decodeEntities(text: string): string {
	return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
		if (code[0] === '#') {
			const isHex = code[1] === 'x' || code[1] === 'X';
			const codePoint = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
			return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
		}
		return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
	});
}

/** Converts the HTML stored by Kaneo's rich text editor to plain text */
export function htmlToText(html: string): string {
	const text = html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<li[^>]*>/gi, '- ')
		.replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n')
		.replace(/<[^>]+>/g, '');

	return decodeEntities(text)
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}
