(function () {
  "use strict";

  function extractTweetData(tweetElement) {
    try {
      // Extract username
      const usernameElement = tweetElement.querySelector(
        '[data-testid="User-Name"] a'
      );
      const username = usernameElement
        ? usernameElement.href.split("/").pop()
        : "Unknown";

      // Extract display name
      const displayNameElement = tweetElement.querySelector(
        '[data-testid="User-Name"] span'
      );
      const displayName = displayNameElement
        ? displayNameElement.textContent.trim()
        : "Unknown";

      // Extract tweet text
      const tweetTextElement = tweetElement.querySelector(
        '[data-testid="tweetText"]'
      );
      const tweetText = tweetTextElement
        ? tweetTextElement.textContent.trim()
        : "";

      // Extract timestamp
      const timeElement = tweetElement.querySelector("time");
      const timestamp = timeElement
        ? timeElement.getAttribute("datetime")
        : null;

      // Extract engagement metrics
      const replyElement = tweetElement.querySelector('[data-testid="reply"]');
      const retweetElement = tweetElement.querySelector(
        '[data-testid="retweet"]'
      );
      const likeElement = tweetElement.querySelector('[data-testid="like"]');

      const replies = extractMetric(replyElement);
      const retweets = extractMetric(retweetElement);
      const likes = extractMetric(likeElement);

      // Extract profile link
      const profileLink = usernameElement ? usernameElement.href : null;

      // Check for business keywords
      const businessKeywords = [
        "dm to order",
        "dm for price",
        "contact us",
        "whatsapp",
        "order now",
        "buy now",
        "shop now",
        "dm me",
        "message me",
      ];

      const containsBusinessKeywords = businessKeywords.some((keyword) =>
        tweetText.toLowerCase().includes(keyword.toLowerCase())
      );

      return tweetText.length > 0
        ? {
            username,
            displayName,
            tweetText,
            timestamp,
            profileLink,
            engagement: { replies, retweets, likes },
            containsBusinessKeywords,
            extractedAt: new Date().toISOString(),
          }
        : null;
    } catch (error) {
      console.error("Error extracting tweet data:", error);
      return null;
    }
  }

  function extractMetric(element) {
    if (!element) return 0;

    const text = element.textContent.trim();
    const number = text.replace(/[^0-9.KM]/g, "");

    if (number.includes("K")) {
      return Math.round(parseFloat(number) * 1000);
    } else if (number.includes("M")) {
      return Math.round(parseFloat(number) * 1000000);
    }

    return parseInt(number) || 0;
  }

  function scrapeTweets(maxResults = 20) {
    const tweetElements = document.querySelectorAll(
      'article[data-testid="tweet"]'
    );
    const results = [];

    for (let i = 0; i < Math.min(tweetElements.length, maxResults); i++) {
      const tweetData = extractTweetData(tweetElements[i]);
      if (tweetData) {
        results.push({
          id: results.length + 1,
          ...tweetData,
        });
      }
    }

    return results;
  }

  // Auto-scroll to load more tweets
  function autoScroll(maxResults) {
    return new Promise((resolve) => {
      let scrollCount = 0;
      const maxScrolls = Math.ceil(maxResults / 10);

      const scrollInterval = setInterval(() => {
        window.scrollBy(0, 500);
        scrollCount++;

        if (scrollCount >= maxScrolls) {
          clearInterval(scrollInterval);
          setTimeout(resolve, 2000);
        }
      }, 1500);
    });
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrape") {
      (async () => {
        try {
          if (
            !window.location.href.includes("x.com") &&
            !window.location.href.includes("twitter.com")
          ) {
            sendResponse({
              success: false,
              error: "Please navigate to X.com first",
            });
            return;
          }

          // Scroll to load more content
          await autoScroll(request.maxResults || 20);

          // Scrape tweets
          const results = scrapeTweets(request.maxResults || 20);

          sendResponse({
            success: true,
            data: results,
            totalResults: results.length,
            scrapedAt: new Date().toISOString(),
          });
        } catch (error) {
          sendResponse({
            success: false,
            error: error.message,
          });
        }
      })();

      return true;
    }
  });
})();
