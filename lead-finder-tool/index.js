
import puppeteer from 'puppeteer';
import { createObjectCsvWriter } from 'csv-writer';
import { extractEmails, extractPhones, analyzeRelevance } from './utils.js';
import fs from 'fs';

const args = process.argv.slice(2);
const query = args.join(' ') || 'digital marketing agency New York';

console.log(`🔎 Starting Lead Finder Agent...`);
console.log(`🎯 Target Query: "${query}"`);

(async () => {
    const browser = await puppeteer.launch({
        headless: false, // Run in visible browser
        defaultViewport: null, // Full width
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set User Agent to avoid immediate blocking
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36');

    try {
        // 1. Search Phase
        console.log(`🌐 Searching on DuckDuckGo...`);
        const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        // Wait for results
        await page.waitForSelector('a[data-testid="result-title-a"]', { timeout: 10000 }).catch(() => console.log("Timeout waiting for selectors"));

        // Extract Links (limit to top 10 for demo speed)
        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[data-testid="result-title-a"]'));
            return anchors.map(a => a.href).slice(0, 10);
        });

        console.log(`✅ Found ${links.length} potential leads.`);

        const leads = [];

        // 2. Scraping Phase
        for (const link of links) {
            console.log(`Canvassing: ${link}`);
            try {
                const leadPage = await browser.newPage();
                await leadPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36');

                await leadPage.goto(link, { waitUntil: 'domcontentloaded', timeout: 15000 });

                // Extract text
                const textContent = await leadPage.evaluate(() => document.body.innerText);

                // Extract contacts
                const emails = extractEmails(textContent);
                const phones = extractPhones(textContent);
                const relevance = analyzeRelevance(textContent, query);

                if (emails.length > 0 || phones.length > 0) {
                    leads.push({
                        url: link,
                        emails: emails.join(', '),
                        phones: phones.join(', '),
                        relevance: relevance.toFixed(2)
                    });
                    console.log(`   -> Found: ${emails.length} emails, ${phones.length} phones`);
                } else {
                    console.log(`   -> No contacts found.`);
                }

                await leadPage.close();
            } catch (err) {
                console.log(`   -> Error visiting ${link}: ${err.message}`);
            }
        }

        // 3. Save Results
        if (leads.length > 0) {
            const csvPath = 'leads.csv';
            const csvWriter = createObjectCsvWriter({
                path: csvPath,
                header: [
                    { id: 'url', title: 'URL' },
                    { id: 'emails', title: 'EMAILS' },
                    { id: 'phones', title: 'PHONES' },
                    { id: 'relevance', title: 'RELEVANCE_SCORE' }
                ]
            });

            await csvWriter.writeRecords(leads);
            console.log(`🎉 Success! Saved ${leads.length} leads to ${csvPath}`);

            // Also save JSON for easier parsing if needed
            fs.writeFileSync('leads.json', JSON.stringify(leads, null, 2));

        } else {
            console.log(`⚠️ No leads found with contact info.`);
        }

    } catch (error) {
        console.error("Agent crashed:", error);
    } finally {
        await browser.close();
    }
})();
