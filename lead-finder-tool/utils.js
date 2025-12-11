
import * as cheerio from 'cheerio';

// Regex for Email
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Simple Regex for Phone (US/International format - lenient)
const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

/**
 * Extracts emails from text content.
 * @param {string} text 
 * @returns {string[]} Unique emails found
 */
export function extractEmails(text) {
    const matches = text.match(emailRegex);
    if (!matches) return [];
    // Filter out common false positives (image extensions, etc if needed, though regex handles most)
    // Deduplicate
    return [...new Set(matches.map(e => e.toLowerCase()))];
}

/**
 * Extracts phone numbers from text content.
 * @param {string} text 
 * @returns {string[]} Unique phones found
 */
export function extractPhones(text) {
    const matches = text.match(phoneRegex);
    if (!matches) return [];
    return [...new Set(matches.map(p => p.trim()))];
}

/**
 * Basic AI Simulation: Analyze relevance based on keywords.
 * In a real agent, this would call an LLM.
 * @param {string} text 
 * @param {string} niche 
 * @returns {number} Score 0-1
 */
export function analyzeRelevance(text, niche) {
    const lowerText = text.toLowerCase();
    const keywords = niche.toLowerCase().split(' ');
    let score = 0;
    keywords.forEach(word => {
        if (lowerText.includes(word)) score += 1;
    });
    return Math.min(score / keywords.length, 1);
}
