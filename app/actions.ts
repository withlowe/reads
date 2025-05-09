"use server"

import crypto from "crypto"

interface UpdateCheckResult {
  contentHash: string
  hasChanged: boolean
  error?: string
  changeDescription?: string
  postUrl?: string
}

/**
 * Fetches a website and checks if its content has changed
 * @param url The URL to check
 * @param previousHash The previous content hash to compare against
 * @returns Object containing the new content hash, whether content has changed, and a description of the changes
 */
export async function checkWebsiteUpdates(url: string, previousHash: string): Promise<UpdateCheckResult> {
  try {
    // Ensure URL has a protocol
    let validUrl = url
    if (!/^https?:\/\//i.test(validUrl)) {
      validUrl = "https://" + validUrl
    }

    // Validate URL
    const validatedUrl = new URL(validUrl)

    try {
      // Fetch the website content with improved error handling
      const response = await fetch(validatedUrl.toString(), {
        headers: {
          // Some websites block requests without proper user agent
          "User-Agent": "Mozilla/5.0 (compatible; BookmarkChecker/1.0)",
          // Add additional headers to help with CORS issues
          Accept: "text/html,application/xhtml+xml,application/xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        next: { revalidate: 0 }, // Disable cache to always get fresh content
        // Add a reasonable timeout
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }).catch((error) => {
        console.error(`Fetch error for ${validUrl}:`, error)
        throw new Error(`Failed to fetch website: ${error.message}`)
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch website: ${response.status} ${response.statusText}`)
      }

      // Try to get the content as text with better error handling
      let content
      try {
        content = await response.text()
      } catch (textError) {
        console.error(`Error reading response text for ${validUrl}:`, textError)

        // Generate a fallback hash for this URL
        const fallbackHash = crypto
          .createHash("sha256")
          .update(`${validUrl}-${new Date().toISOString().split("T")[0]}`)
          .digest("hex")

        // Check if the hash has changed from the previous one
        const hasChanged = previousHash !== "" && previousHash !== fallbackHash

        return {
          contentHash: fallbackHash,
          hasChanged,
          error: `Could not read content: ${textError instanceof Error ? textError.message : "Unknown error"}`,
          changeDescription: hasChanged ? "Site may have been updated" : undefined,
        }
      }

      // Check if this is an RSS feed
      const isRssFeed =
        url.includes("/feed") ||
        url.includes(".rss") ||
        url.includes("/rss") ||
        url.includes("atom.xml") ||
        url.includes("/atom") ||
        url.endsWith(".xml") ||
        content.includes("<rss") ||
        content.includes("<feed")

      let mainContent
      let changeDescription = ""
      let postUrl = undefined

      if (isRssFeed) {
        // For RSS feeds, extract the items and use them for comparison
        const feedItems = extractRssItems(content)
        mainContent = JSON.stringify(feedItems)

        // Create a change description from the newest items
        if (feedItems.length > 0) {
          changeDescription = `New post: ${feedItems[0].title}`
          if (feedItems.length > 1) {
            changeDescription += ` and ${feedItems.length - 1} more`
          }

          // Store the post URL for linking
          postUrl = feedItems[0].link
        }
      } else {
        // For regular websites, extract the main content
        mainContent = extractMainContent(content)
      }

      // Create a hash of the content
      const contentHash = crypto.createHash("sha256").update(mainContent).digest("hex")

      // Check if the content has changed
      const hasChanged = previousHash !== "" && previousHash !== contentHash

      return {
        contentHash,
        hasChanged,
        changeDescription,
        postUrl,
      }
    } catch (fetchError) {
      console.error(`Error fetching ${validUrl}:`, fetchError)

      // Generate a fallback hash based on the URL and current time
      // This ensures we don't keep reporting the same error as a change
      const fallbackHash = crypto
        .createHash("sha256")
        .update(`${validUrl}-${new Date().toDateString()}-error`)
        .digest("hex")

      // If we had a previous hash, consider this a change (error state change)
      const hasChanged = previousHash !== "" && previousHash !== fallbackHash

      return {
        contentHash: fallbackHash,
        hasChanged,
        error: fetchError instanceof Error ? fetchError.message : "Unknown fetch error",
        changeDescription: hasChanged ? "Site may have been updated" : undefined,
      }
    }
  } catch (error) {
    console.error("Error checking website updates:", error)

    // Create a fallback hash for completely invalid URLs
    const fallbackHash = crypto.createHash("sha256").update(`error-${url}-${new Date().toDateString()}`).digest("hex")

    return {
      contentHash: fallbackHash,
      hasChanged: false,
      error: error instanceof Error ? error.message : "Failed to check for updates",
    }
  }
}

/**
 * Extracts the main content from HTML to avoid false positives from timestamps, ads, etc.
 * This is a simplified version - a production version would be more sophisticated
 */
function extractMainContent(html: string): string {
  try {
    // Remove script tags and their content
    let content = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")

    // Remove style tags and their content
    content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")

    // Remove comments
    content = content.replace(/<!--[\s\S]*?-->/g, "")

    // Remove common dynamic elements that change frequently but don't represent meaningful updates
    // This is a simplified approach - a real implementation would be more sophisticated
    content = content.replace(/<time[^>]*>.*?<\/time>/gi, "") // Remove time elements
    content = content.replace(/\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b/gi, "") // Remove time strings
    content = content.replace(/\b(today|yesterday|tomorrow)\b/gi, "") // Remove relative day references

    // Remove whitespace
    content = content.replace(/\s+/g, " ").trim()

    return content
  } catch (error) {
    console.error("Error extracting main content:", error)
    return html // Fall back to the original HTML if extraction fails
  }
}

/**
 * Extracts items from an RSS feed
 * @param xml The RSS feed XML content
 * @returns Array of RSS items with title, link, and date
 */
function extractRssItems(xml: string): Array<{ title: string; link: string; pubDate: string }> {
  try {
    // Simple regex-based extraction for server-side
    // In a production app, you'd use a proper XML parser
    const items: Array<{ title: string; link: string; pubDate: string }> = []

    // Extract RSS items
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    const itemMatches = xml.matchAll(itemRegex)

    for (const match of itemMatches) {
      const itemContent = match[1]

      // Extract title
      const titleMatch = /<title>(.*?)<\/title>/i.exec(itemContent)
      const title = titleMatch ? titleMatch[1] : "No title"

      // Extract link
      const linkMatch = /<link>(.*?)<\/link>/i.exec(itemContent)
      // Some RSS feeds use CDATA for links
      const cdataLinkMatch = /<link>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/link>/i.exec(itemContent)
      const link = cdataLinkMatch ? cdataLinkMatch[1] : linkMatch ? linkMatch[1] : "#"

      // Extract publication date
      const dateMatch = /<pubDate>(.*?)<\/pubDate>/i.exec(itemContent)
      const pubDate = dateMatch ? dateMatch[1] : new Date().toISOString()

      items.push({ title, link, pubDate })

      // Limit to 5 most recent items
      if (items.length >= 5) break
    }

    // If no RSS items found, try Atom format
    if (items.length === 0) {
      const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
      const entryMatches = xml.matchAll(entryRegex)

      for (const match of entryMatches) {
        const entryContent = match[1]

        // Extract title
        const titleMatch = /<title>(.*?)<\/title>/i.exec(entryContent)
        const title = titleMatch ? titleMatch[1] : "No title"

        // Extract link (Atom format uses href attribute)
        const linkMatch = /<link[^>]*href="([^"]*)"[^>]*>/i.exec(entryContent)
        const link = linkMatch ? linkMatch[1] : "#"

        // Extract publication date
        const dateMatch = /<published>(.*?)<\/published>/i.exec(entryContent)
        const pubDate = dateMatch ? dateMatch[1] : new Date().toISOString()

        items.push({ title, link, pubDate })

        // Limit to 5 most recent items
        if (items.length >= 5) break
      }
    }

    return items
  } catch (error) {
    console.error("Error extracting RSS items:", error)
    return []
  }
}

async function generateChangeDescription(newContent: string, previousHash: string, siteName: string): Promise<string> {
  return "Content Changed"
}
