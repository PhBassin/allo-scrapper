import React from 'react';

/**
 * Highlights all occurrences of a search query within a text string.
 * 
 * @param text - The text to search within
 * @param query - The search query to highlight (case-insensitive)
 * @returns React nodes with highlighted matches wrapped in <mark> elements
 * 
 * @example
 * highlightText("Marie-Antoinette", "mar")
 * // Returns: [<mark key="0">Mar</mark>, "ie-Antoinette"]
 */
export function highlightText(
  text: string,
  query: string
): React.ReactNode {
  // Handle edge cases
  if (!query || query.trim().length === 0) {
    return text;
  }
  
  if (!text || text.length === 0) {
    return '';
  }

  // Convert to lowercase for case-insensitive search
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Find all matches
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let matchIndex = lowerText.indexOf(lowerQuery, lastIndex);

  // If no match found, return original text
  if (matchIndex === -1) {
    return text;
  }

  // Build array of text parts and highlighted matches
  while (matchIndex !== -1) {
    // Add text before the match
    if (matchIndex > lastIndex) {
      parts.push(text.substring(lastIndex, matchIndex));
    }

    // Add highlighted match
    const matchText = text.substring(matchIndex, matchIndex + lowerQuery.length);
    parts.push(
      <mark key={`mark-${matchIndex}`}>
        {matchText}
      </mark>
    );

    // Move to next potential match
    lastIndex = matchIndex + lowerQuery.length;
    matchIndex = lowerText.indexOf(lowerQuery, lastIndex);
  }

  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
