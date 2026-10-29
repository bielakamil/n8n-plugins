import { describe, expect, it } from 'vitest';
import { htmlToText } from '../../nodes/Kaneo/utils/html';

describe('htmlToText', () => {
	it('turns paragraphs, line breaks and list items into lines', () => {
		expect(htmlToText('<p>First</p><p>Second<br>line</p><ul><li>a</li><li>b</li></ul>')).toBe(
			'First\nSecond\nline\n- a\n- b',
		);
	});

	it('decodes named and numeric entities', () => {
		expect(htmlToText('https://x.test/?a=1&amp;b=2 &lt;tag&gt; &#39;q&#x27; &nbsp;ok')).toBe(
			"https://x.test/?a=1&b=2 <tag> 'q'  ok".replace(' ', ' '),
		);
	});

	it('leaves plain text and unknown entities untouched', () => {
		expect(htmlToText('Just text &foo;')).toBe('Just text &foo;');
	});
});
