// popup.js - Extension popup logic
document.addEventListener("DOMContentLoaded", function () {
  const scrapeBtn = document.getElementById("scrapeBtn");
  const maxResultsSelect = document.getElementById("maxResults");
  const statusDiv = document.getElementById("status");
  const resultsDiv = document.getElementById("results");

  let scrapedData = null;

  scrapeBtn.addEventListener("click", async function () {
    const maxResults = parseInt(maxResultsSelect.value);

    try {
      scrapeBtn.disabled = true;
      scrapeBtn.textContent = "Scraping...";
      showStatus("Scraping tweets from current page...", "loading");
      resultsDiv.style.display = "none";

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!tab.url.includes("x.com") && !tab.url.includes("twitter.com")) {
        throw new Error("Please navigate to X.com or Twitter.com first");
      }

      // Sending message to content script
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: "scrape",
        maxResults: maxResults,
      });

      if (response.success) {
        scrapedData = response;
        displayResults(response.data);
        showStatus(
          `Successfully scraped ${response.totalResults} tweets!`,
          "success"
        );
      } else {
        throw new Error(response.error || "Scraping failed");
      }
    } catch (error) {
      console.error("Scraping error:", error);
      showStatus(`Error: ${error.message}`, "error");
    } finally {
      // Re-enable button
      scrapeBtn.disabled = false;
      scrapeBtn.textContent = "Start Scraping Current Page";
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = "block";
  }

  function displayResults(tweets) {
    if (!tweets || tweets.length === 0) {
      resultsDiv.innerHTML = "<p>No tweets found</p>";
      resultsDiv.style.display = "block";
      return;
    }

    const businessLeads = tweets.filter(
      (tweet) => tweet.containsBusinessKeywords
    );

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <small>Found ${tweets.length} tweets • ${businessLeads.length} business leads</small>
        <button class="export-btn" onclick="exportToCSV()">Export CSV</button>
      </div>
    `;

    tweets.slice(0, 5).forEach((tweet) => {
      html += `
        <div class="result-item">
          <div class="result-username">@${tweet.username}</div>
          <div class="result-text">${tweet.tweetText.substring(0, 100)}${
        tweet.tweetText.length > 100 ? "..." : ""
      }</div>
          ${
            tweet.containsBusinessKeywords
              ? '<span class="business-indicator">Business Lead</span>'
              : ""
          }
        </div>
      `;
    });

    if (tweets.length > 5) {
      html += `<div style="text-align: center; margin-top: 10px; font-size: 12px; color: #536471;">
        Showing first 5 results. Export CSV for all ${tweets.length} tweets.
      </div>`;
    }

    resultsDiv.innerHTML = html;
    resultsDiv.style.display = "block";
  }

  // Export function
  window.exportToCSV = function () {
    if (!scrapedData || !scrapedData.data) {
      alert("No data to export");
      return;
    }

    const tweets = scrapedData.data;
    const csvContent = [
      // Headers
      [
        "Username",
        "Display Name",
        "Tweet Text",
        "Profile Link",
        "Replies",
        "Retweets",
        "Likes",
        "Business Lead",
        "Timestamp",
      ].join(","),
      // Rows
      ...tweets.map((tweet) =>
        [
          tweet.username,
          `"${tweet.displayName}"`,
          `"${tweet.tweetText.replace(/"/g, '""')}"`,
          tweet.profileLink || "",
          tweet.engagement.replies,
          tweet.engagement.retweets,
          tweet.engagement.likes,
          tweet.containsBusinessKeywords,
          tweet.timestamp || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    chrome.downloads.download({
      url: url,
      filename: `x-leads-${new Date().toISOString().split("T")[0]}.csv`,
    });
  };
});
