import chai from 'chai';
import { parseTemplateExplanation, parseExplanationAmount } from '../sdk/utils/reward-explanation-utils';

describe('rewards explanation parsing', () => {
  it('should parse a proof template with a single value data entry', () => {
    const template = 'Template {a}';
    const data = { a: 'Value A' };

    chai.expect(parseTemplateExplanation(template, data)).to.eq('Template Value A');
  });

  it('should parse whatever values match and keep not defined values as is', () => {
    const template = 'Template {a} {b}';
    const data = { a: 'Value A' };

    chai.expect(parseTemplateExplanation(template, data)).to.eq('Template Value A {b}');
  });

  it('should not parse values that do not correlate to the ones defined in the template', () => {
    const template = 'Template {a}';
    const data = { b: 'Value B' };

    chai.expect(parseTemplateExplanation(template, data)).to.eq('Template {a}');
  });

  it('should return the template as is if no data is provided', () => {
    const template = 'Template {a}';

    chai.expect(parseTemplateExplanation(template, undefined)).to.eq('Template {a}');
  });

  it('should return the template replaced for sub layered values', () => {
    const template = 'Template {a.b}';
    const data = { a: { b: 'Value B' } };

    chai.expect(parseTemplateExplanation(template, data)).to.eq('Template Value B');
  });

  it('should parse token amount to human readable string with default 2 decimals', () => {
    const amount = '3498646326433040826368';
    const token = '3498.65';

    chai.expect(parseExplanationAmount(amount, 18, 2)).to.eq(token);
  });

  it('should parse token amount to human readable string with defined decimals', () => {
    const amount = '3498646326433040826368';
    const token = '3498.646';

    chai.expect(parseExplanationAmount(amount, 18, 3)).to.eq(token);
  });

  it('should parse token amount to human readable string with defined decimals, and different token decimals', () => {
    const amount = '3498646326433040826368';
    const token = '3498646326433.0408';

    chai.expect(parseExplanationAmount(amount, 9, 4)).to.eq(token);
  });
});
