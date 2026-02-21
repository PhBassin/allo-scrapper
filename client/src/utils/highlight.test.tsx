import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { highlightText } from './highlight';

describe('highlightText', () => {
  describe('basic functionality', () => {
    it('should highlight exact substring match (case-insensitive)', () => {
      const result = highlightText('Marie-Antoinette', 'mar');
      const { container } = render(<>{result}</>);
      
      const mark = container.querySelector('mark');
      expect(mark).toBeTruthy();
      expect(mark?.textContent).toBe('Mar');
      expect(container.textContent).toBe('Marie-Antoinette');
    });

    it('should preserve original text casing', () => {
      const result = highlightText('MATRIX', 'matrix');
      const { container } = render(<>{result}</>);
      
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('MATRIX');
    });

    it('should return plain text when query is empty', () => {
      const result = highlightText('Some text', '');
      expect(result).toBe('Some text');
    });

    it('should return empty string when text is empty', () => {
      const result = highlightText('', 'query');
      expect(result).toBe('');
    });

    it('should return plain text when no match found', () => {
      const result = highlightText('Marie-Antoinette', 'xyz');
      expect(result).toBe('Marie-Antoinette');
    });
  });

  describe('multiple occurrences', () => {
    it('should highlight all occurrences of the query', () => {
      const result = highlightText('Madagascar Madagascar', 'ma');
      const { container } = render(<>{result}</>);
      
      const marks = container.querySelectorAll('mark');
      expect(marks.length).toBe(2);
      expect(marks[0].textContent).toBe('Ma');
      expect(marks[1].textContent).toBe('Ma');
    });

    it('should highlight overlapping pattern correctly', () => {
      const result = highlightText('aaa', 'aa');
      const { container } = render(<>{result}</>);
      
      // Should highlight first occurrence only to avoid overlap
      const marks = container.querySelectorAll('mark');
      expect(marks.length).toBeGreaterThan(0);
      expect(container.textContent).toBe('aaa');
    });
  });

  describe('position variations', () => {
    it('should highlight match at the start of text', () => {
      const result = highlightText('Matrix', 'mat');
      const { container } = render(<>{result}</>);
      
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('Mat');
      expect(container.textContent).toBe('Matrix');
    });

    it('should highlight match in the middle of text', () => {
      const result = highlightText('The Matrix', 'mat');
      const { container } = render(<>{result}</>);
      
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('Mat');
      expect(container.textContent).toBe('The Matrix');
    });

    it('should highlight match at the end of text', () => {
      const result = highlightText('Cinema', 'ema');
      const { container } = render(<>{result}</>);
      
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('ema');
      expect(container.textContent).toBe('Cinema');
    });
  });

  describe('edge cases', () => {
    it('should handle query longer than text', () => {
      const result = highlightText('Hi', 'Hello World');
      expect(result).toBe('Hi');
    });

    it('should handle special characters in text', () => {
      const result = highlightText('Marie-Antoinette', 'ie-an');
      const { container } = render(<>{result}</>);
      
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('ie-An');
    });

    it('should handle whitespace in query', () => {
      const result = highlightText('Le Gâteau du Président', 'Le ');
      const { container } = render(<>{result}</>);
      
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('Le ');
    });

    it('should handle accented characters', () => {
      const result = highlightText('Le Gâteau', 'gât');
      const { container } = render(<>{result}</>);
      
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('Gât');
    });

    it('should handle numbers in query', () => {
      const result = highlightText('Matrix 2', '2');
      const { container } = render(<>{result}</>);
      
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('2');
    });
  });

  describe('React component output', () => {
    it('should return React nodes that can be rendered', () => {
      const result = highlightText('Matrix', 'mat');
      const { container } = render(<div>{result}</div>);
      
      expect(container.querySelector('div')).toBeTruthy();
      expect(container.textContent).toBe('Matrix');
    });

    it('should use mark elements for semantic highlighting', () => {
      const result = highlightText('Matrix', 'mat');
      const { container } = render(<>{result}</>);
      
      const mark = container.querySelector('mark');
      expect(mark?.tagName).toBe('MARK');
    });
  });
});
