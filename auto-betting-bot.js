;(() => {
  // ============================================
  // LUCIFER AUTO BETTING BOT - Pure JavaScript
  // ============================================

  // Configuration
  var CONFIG = {
    RESULTS_API: "https://api.tkshostify.in/api/1m/latest",
    TELEGRAM_BOT_API: "8231100734:AAFmbMJ3tvRDNzKoyK5IrQbXZ4NzNhcS2Ow",
    TELEGRAM_GROUP_IDS: ["-1002411882816", "-1003182588648"],
    FETCH_INTERVAL: 2000,
    MAX_HISTORY: 200,
  }

  // State
  var state = {
    history: [],
    lastProcessedIssue: "",
    last10Results: [],
    isRunning: false,
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  function getColorFromNumber(num) {
    // GREEN: 1,3,5,7,9 | RED: 0,2,4,6,8
    if (num === 1 || num === 3 || num === 5 || num === 7 || num === 9) return "GREEN"
    return "RED"
  }

  function getSizeFromNumber(num) {
    // BIG: 5,6,7,8,9 | SMALL: 0,1,2,3,4
    if (num >= 5) return "BIG"
    return "SMALL"
  }

  function getOppositeSizePrediction(previousSize) {
    return previousSize === "BIG" ? "SMALL" : "BIG"
  }

  function determineLevel(recentHistory) {
    var consecutiveLosses = 0

    for (var i = 0; i < recentHistory.length; i++) {
      var item = recentHistory[i]
      if (item.status === "LOSE") {
        consecutiveLosses++
      } else if (item.status === "WIN") {
        break
      } else {
        break
      }
    }

    var levelMap = { 0: 1, 1: 2, 2: 3, 3: 4 }

    if (consecutiveLosses >= 4) {
      return 1
    }

    return levelMap[consecutiveLosses] || 1
  }

  function predictLucifer(latestResultNumber) {
    var size = getSizeFromNumber(latestResultNumber)
    return {
      predictedValue: size,
      reason: "Lucifer Mode: Latest result " + latestResultNumber + " is " + size + ", predicting " + size,
    }
  }

  function predictNextColor(results, recentHistory, totalPredictions) {
    recentHistory = recentHistory || []
    totalPredictions = totalPredictions || 0

    var last50 = results.slice(0, Math.min(50, results.length))

    if (last50.length < 2) {
      return {
        predictedType: "SKIP",
        predictedValue: "SKIP",
        predictedNumber: null,
        confidence: 0,
        mode: "SKIP",
        level: 1,
        matchInfo: null,
        calculations: null,
        shouldPredict: false,
        reason: "Insufficient data (need at least 2 results)",
      }
    }

    var latestResult = last50[0].result_number
    var currentIssueNumber = results[0].issue_number
    var predictedIssueNumber = (BigInt(currentIssueNumber) + BigInt(1)).toString()

    var currentLevel = determineLevel(recentHistory)

    if (currentLevel === 3 || currentLevel === 4) {
      var previousSize = getSizeFromNumber(latestResult)
      var oppositePrediction = getOppositeSizePrediction(previousSize)

      return {
        predictedType: "SIZE",
        predictedValue: oppositePrediction,
        predictedNumber: null,
        confidence: 100,
        mode: "LEVEL_3",
        level: currentLevel,
        matchInfo: {
          latestResult: latestResult,
          totalMatches: 0,
          matchedValues: [],
          matchedValuesDisplay: [],
          colorCounts: { GREEN: 0, RED: 0 },
          sizeCounts: { BIG: 0, SMALL: 0 },
        },
        calculations: null,
        shouldPredict: true,
        predictedIssueNumber: predictedIssueNumber,
        reason:
          "Level " +
          currentLevel +
          ": Latest result " +
          latestResult +
          " is " +
          previousSize +
          ", predicting opposite: " +
          oppositePrediction,
      }
    }

    var luciferPrediction = predictLucifer(latestResult)

    return {
      predictedType: "SIZE",
      predictedValue: luciferPrediction.predictedValue,
      predictedNumber: null,
      confidence: 100,
      mode: "LUCIFER",
      level: currentLevel,
      matchInfo: {
        latestResult: latestResult,
        totalMatches: 0,
        matchedValues: [],
        matchedValuesDisplay: [],
        colorCounts: { GREEN: 0, RED: 0 },
        sizeCounts: { BIG: 0, SMALL: 0 },
      },
      calculations: null,
      shouldPredict: true,
      predictedIssueNumber: predictedIssueNumber,
      reason: "Level " + currentLevel + " (Lucifer): " + luciferPrediction.reason,
    }
  }

  // ============================================
  // TELEGRAM FUNCTIONS
  // ============================================

  function formatPredictionListForTelegram(predictions, currentLevel) {
    var message = "LUCIFER BOT ~ " + currentLevel + "/4 LVL ❤️✅\n"
    message += "━━━━━━━━━━━━━━━\n"

    var reversedPredictions = predictions.slice().reverse()

    for (var i = 0; i < reversedPredictions.length; i++) {
      var pred = reversedPredictions[i]
      var shortIssue = pred.number.substring(pred.number.length - 3)
      var statusEmoji = ""

      if (pred.result === "WIN") {
        statusEmoji = "❤️❤️❤️"
      } else if (pred.result === "LOSE") {
        statusEmoji = "❤️‍🩹❤️‍🩹❤️‍🩹"
      }

      message += shortIssue + " " + pred.prediction + " " + statusEmoji + "\n"
    }

    return message
  }

  function sendPredictionToTelegram(predictions, currentLevel) {
    var formattedMessage = formatPredictionListForTelegram(predictions, currentLevel)

    if (!formattedMessage.trim()) {
      return Promise.resolve(false)
    }

    var telegramUrl = "https://api.telegram.org/bot" + CONFIG.TELEGRAM_BOT_API + "/sendMessage"
    var promises = []

    for (var i = 0; i < CONFIG.TELEGRAM_GROUP_IDS.length; i++) {
      var chatId = CONFIG.TELEGRAM_GROUP_IDS[i]
      promises.push(
        fetch(telegramUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: formattedMessage,
            parse_mode: "HTML",
          }),
        }),
      )
    }

    return Promise.all(promises)
      .then((results) => {
        for (var j = 0; j < results.length; j++) {
          if (!results[j].ok) {
            console.log("[BOT] Telegram API error for group " + (j + 1))
            return false
          }
        }
        console.log("[BOT] Telegram message sent successfully")
        return true
      })
      .catch((err) => {
        console.log("[BOT] Error sending to Telegram:", err)
        return false
      })
  }

  // ============================================
  // STORAGE FUNCTIONS
  // ============================================

  function loadFromStorage() {
    try {
      var saved = localStorage.getItem("bot_prediction_history")
      if (saved) {
        var parsed = JSON.parse(saved)
        return Array.isArray(parsed) ? parsed.slice(0, CONFIG.MAX_HISTORY) : []
      }
    } catch (e) {
      localStorage.removeItem("bot_prediction_history")
    }
    return []
  }

  function saveToStorage(history) {
    try {
      localStorage.setItem("bot_prediction_history", JSON.stringify(history.slice(0, CONFIG.MAX_HISTORY)))
    } catch (e) {
      console.log("[BOT] Error saving to storage:", e)
    }
  }

  function loadLastProcessedIssue() {
    try {
      return localStorage.getItem("bot_last_processed_issue") || ""
    } catch (e) {
      return ""
    }
  }

  function saveLastProcessedIssue(issue) {
    try {
      localStorage.setItem("bot_last_processed_issue", issue)
    } catch (e) {}
  }

  // ============================================
  // AUTO BETTING SYSTEM
  // ============================================

  var BETTING_CONFIG = {
    BASE_BET: 10,
    MARTINGALE_MULTIPLIER: 2.2,
    MAX_LEVEL: 4,
    BALANCE: 1000,
    AUTO_BET_ENABLED: true,
  }

  var bettingState = {
    currentBalance: BETTING_CONFIG.BALANCE,
    currentBet: BETTING_CONFIG.BASE_BET,
    currentLevel: 1,
    totalBets: 0,
    totalWins: 0,
    totalLosses: 0,
    profit: 0,
    betHistory: [],
  }

  function calculateBetAmount(level) {
    if (level === 1) return BETTING_CONFIG.BASE_BET
    var bet = BETTING_CONFIG.BASE_BET
    for (var i = 1; i < level; i++) {
      bet = Math.ceil(bet * BETTING_CONFIG.MARTINGALE_MULTIPLIER)
    }
    return bet
  }

  function placeBet(prediction, level) {
    var betAmount = calculateBetAmount(level)

    if (betAmount > bettingState.currentBalance) {
      console.log(
        "[BOT] Insufficient balance for bet. Current: " + bettingState.currentBalance + ", Required: " + betAmount,
      )
      return null
    }

    bettingState.currentBalance -= betAmount
    bettingState.totalBets++
    bettingState.currentBet = betAmount

    var bet = {
      id: Date.now(),
      prediction: prediction,
      amount: betAmount,
      level: level,
      timestamp: new Date().toISOString(),
      status: "PENDING",
      payout: 0,
    }

    bettingState.betHistory.unshift(bet)
    console.log(
      "[BOT] Bet placed: " +
        prediction +
        " | Amount: " +
        betAmount +
        " | Level: " +
        level +
        " | Balance: " +
        bettingState.currentBalance,
    )

    return bet
  }

  function resolveBet(betId, result) {
    for (var i = 0; i < bettingState.betHistory.length; i++) {
      var bet = bettingState.betHistory[i]
      if (bet.id === betId) {
        bet.status = result
        if (result === "WIN") {
          var payout = bet.amount * 1.96
          bet.payout = payout
          bettingState.currentBalance += payout
          bettingState.totalWins++
          bettingState.profit += payout - bet.amount
          bettingState.currentLevel = 1
          console.log(
            "[BOT] WIN! Payout: " +
              payout.toFixed(2) +
              " | Balance: " +
              bettingState.currentBalance.toFixed(2) +
              " | Profit: " +
              bettingState.profit.toFixed(2),
          )
        } else if (result === "LOSE") {
          bettingState.totalLosses++
          bettingState.profit -= bet.amount
          bettingState.currentLevel = Math.min(bettingState.currentLevel + 1, BETTING_CONFIG.MAX_LEVEL)
          if (bettingState.currentLevel > BETTING_CONFIG.MAX_LEVEL) {
            bettingState.currentLevel = 1
          }
          console.log(
            "[BOT] LOSE! Lost: " +
              bet.amount +
              " | Balance: " +
              bettingState.currentBalance.toFixed(2) +
              " | Profit: " +
              bettingState.profit.toFixed(2),
          )
        }
        return bet
      }
    }
    return null
  }

  // ============================================
  // UI RENDERING
  // ============================================

  function createUI() {
    var container = document.getElementById("bot-container")
    if (!container) {
      container = document.createElement("div")
      container.id = "bot-container"
      document.body.appendChild(container)
    }

    container.innerHTML =
      '\
      <style>\
        #bot-container { \
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; \
          background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); \
          min-height: 100vh; \
          padding: 20px; \
          color: #e2e8f0; \
        }\
        .bot-header { \
          text-align: center; \
          padding: 20px; \
          margin-bottom: 20px; \
        }\
        .bot-title { \
          font-size: 28px; \
          font-weight: bold; \
          color: #22d3ee; \
          margin-bottom: 8px; \
        }\
        .bot-subtitle { \
          font-size: 14px; \
          color: #94a3b8; \
        }\
        .stats-grid { \
          display: grid; \
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); \
          gap: 15px; \
          margin-bottom: 20px; \
        }\
        .stat-card { \
          background: rgba(30, 41, 59, 0.8); \
          border-radius: 12px; \
          padding: 15px; \
          text-align: center; \
          border: 1px solid rgba(148, 163, 184, 0.1); \
        }\
        .stat-label { \
          font-size: 12px; \
          color: #94a3b8; \
          margin-bottom: 5px; \
        }\
        .stat-value { \
          font-size: 24px; \
          font-weight: bold; \
        }\
        .stat-value.green { color: #22c55e; }\
        .stat-value.red { color: #ef4444; }\
        .stat-value.blue { color: #22d3ee; }\
        .stat-value.yellow { color: #fbbf24; }\
        .results-section { \
          background: rgba(30, 41, 59, 0.8); \
          border-radius: 12px; \
          padding: 20px; \
          margin-bottom: 20px; \
          border: 1px solid rgba(148, 163, 184, 0.1); \
        }\
        .section-title { \
          font-size: 18px; \
          font-weight: bold; \
          color: #e2e8f0; \
          margin-bottom: 15px; \
        }\
        .results-row { \
          display: flex; \
          gap: 10px; \
          flex-wrap: wrap; \
          justify-content: center; \
        }\
        .result-ball { \
          width: 45px; \
          height: 45px; \
          border-radius: 50%; \
          display: flex; \
          align-items: center; \
          justify-content: center; \
          font-weight: bold; \
          font-size: 18px; \
          color: white; \
          border: 2px solid rgba(255,255,255,0.3); \
        }\
        .result-ball.green { background: #22c55e; }\
        .result-ball.red { background: #ef4444; }\
        .prediction-card { \
          background: linear-gradient(135deg, rgba(34, 211, 238, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%); \
          border-radius: 12px; \
          padding: 20px; \
          margin-bottom: 20px; \
          border: 1px solid rgba(34, 211, 238, 0.3); \
          text-align: center; \
        }\
        .current-prediction { \
          font-size: 32px; \
          font-weight: bold; \
          margin: 10px 0; \
        }\
        .current-prediction.big { color: #22c55e; }\
        .current-prediction.small { color: #ef4444; }\
        .level-badge { \
          display: inline-block; \
          padding: 5px 15px; \
          border-radius: 20px; \
          font-size: 14px; \
          font-weight: bold; \
        }\
        .level-badge.level-1 { background: #22c55e; color: white; }\
        .level-badge.level-2 { background: #fbbf24; color: #1e293b; }\
        .level-badge.level-3 { background: #f97316; color: white; }\
        .level-badge.level-4 { background: #ef4444; color: white; }\
        .history-table { \
          width: 100%; \
          border-collapse: collapse; \
        }\
        .history-table th, .history-table td { \
          padding: 12px; \
          text-align: center; \
          border-bottom: 1px solid rgba(148, 163, 184, 0.1); \
        }\
        .history-table th { \
          color: #94a3b8; \
          font-size: 12px; \
          font-weight: 600; \
          text-transform: uppercase; \
        }\
        .status-badge { \
          padding: 4px 10px; \
          border-radius: 12px; \
          font-size: 12px; \
          font-weight: bold; \
        }\
        .status-badge.win { background: rgba(34, 197, 94, 0.2); color: #22c55e; }\
        .status-badge.lose { background: rgba(239, 68, 68, 0.2); color: #ef4444; }\
        .status-badge.pending { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }\
        .status-badge.skip { background: rgba(148, 163, 184, 0.2); color: #94a3b8; }\
        .controls { \
          display: flex; \
          gap: 10px; \
          justify-content: center; \
          margin-bottom: 20px; \
        }\
        .btn { \
          padding: 12px 24px; \
          border-radius: 8px; \
          font-weight: bold; \
          cursor: pointer; \
          border: none; \
          font-size: 14px; \
          transition: all 0.2s; \
        }\
        .btn-primary { \
          background: #22d3ee; \
          color: #0f172a; \
        }\
        .btn-danger { \
          background: #ef4444; \
          color: white; \
        }\
        .btn:hover { \
          transform: translateY(-2px); \
          box-shadow: 0 4px 12px rgba(0,0,0,0.3); \
        }\
        .auto-bet-status { \
          padding: 10px 20px; \
          border-radius: 8px; \
          font-weight: bold; \
          text-align: center; \
          margin-bottom: 15px; \
        }\
        .auto-bet-status.active { \
          background: rgba(34, 197, 94, 0.2); \
          color: #22c55e; \
          border: 1px solid #22c55e; \
        }\
        .auto-bet-status.inactive { \
          background: rgba(239, 68, 68, 0.2); \
          color: #ef4444; \
          border: 1px solid #ef4444; \
        }\
        .bet-config { \
          display: grid; \
          grid-template-columns: repeat(2, 1fr); \
          gap: 10px; \
          margin-top: 15px; \
        }\
        .config-item { \
          background: rgba(15, 23, 42, 0.5); \
          padding: 10px; \
          border-radius: 8px; \
        }\
        .config-label { \
          font-size: 11px; \
          color: #94a3b8; \
        }\
        .config-value { \
          font-size: 16px; \
          font-weight: bold; \
          color: #22d3ee; \
        }\
        .loading-spinner { \
          width: 40px; \
          height: 40px; \
          border: 3px solid rgba(34, 211, 238, 0.3); \
          border-top-color: #22d3ee; \
          border-radius: 50%; \
          animation: spin 1s linear infinite; \
          margin: 20px auto; \
        }\
        @keyframes spin { \
          to { transform: rotate(360deg); } \
        }\
      </style>\
      <div class="bot-header">\
        <div class="bot-title">LUCIFER AUTO BOT</div>\
        <div class="bot-subtitle">Automatic Prediction & Betting System</div>\
      </div>\
      <div class="auto-bet-status ' +
      (BETTING_CONFIG.AUTO_BET_ENABLED ? "active" : "inactive") +
      '">\
        AUTO BETTING: ' +
      (BETTING_CONFIG.AUTO_BET_ENABLED ? "ACTIVE" : "INACTIVE") +
      '\
      </div>\
      <div class="stats-grid" id="stats-grid"></div>\
      <div class="prediction-card" id="prediction-card">\
        <div class="loading-spinner"></div>\
        <div>Loading prediction...</div>\
      </div>\
      <div class="controls">\
        <button class="btn btn-primary" onclick="window.botToggleAutoBet()">Toggle Auto Bet</button>\
        <button class="btn btn-danger" onclick="window.botClearHistory()">Clear History</button>\
      </div>\
      <div class="results-section">\
        <div class="section-title">Last 10 Results</div>\
        <div class="results-row" id="results-row"></div>\
      </div>\
      <div class="results-section">\
        <div class="section-title">Prediction History</div>\
        <div style="overflow-x: auto;">\
          <table class="history-table">\
            <thead>\
              <tr>\
                <th>Issue</th>\
                <th>Prediction</th>\
                <th>Result</th>\
                <th>Bet</th>\
                <th>Status</th>\
              </tr>\
            </thead>\
            <tbody id="history-tbody"></tbody>\
          </table>\
        </div>\
      </div>\
    '

    updateUI()
  }

  function updateUI() {
    // Update stats
    var statsGrid = document.getElementById("stats-grid")
    if (statsGrid) {
      var winRate =
        bettingState.totalBets > 0 ? ((bettingState.totalWins / bettingState.totalBets) * 100).toFixed(1) : 0
      statsGrid.innerHTML =
        '\
        <div class="stat-card">\
          <div class="stat-label">Balance</div>\
          <div class="stat-value blue">' +
        bettingState.currentBalance.toFixed(2) +
        '</div>\
        </div>\
        <div class="stat-card">\
          <div class="stat-label">Profit/Loss</div>\
          <div class="stat-value ' +
        (bettingState.profit >= 0 ? "green" : "red") +
        '">' +
        (bettingState.profit >= 0 ? "+" : "") +
        bettingState.profit.toFixed(2) +
        '</div>\
        </div>\
        <div class="stat-card">\
          <div class="stat-label">Win Rate</div>\
          <div class="stat-value yellow">' +
        winRate +
        '%</div>\
        </div>\
        <div class="stat-card">\
          <div class="stat-label">Total Bets</div>\
          <div class="stat-value blue">' +
        bettingState.totalBets +
        '</div>\
        </div>\
        <div class="stat-card">\
          <div class="stat-label">Wins</div>\
          <div class="stat-value green">' +
        bettingState.totalWins +
        '</div>\
        </div>\
        <div class="stat-card">\
          <div class="stat-label">Losses</div>\
          <div class="stat-value red">' +
        bettingState.totalLosses +
        "</div>\
        </div>\
      "
    }

    // Update results row
    var resultsRow = document.getElementById("results-row")
    if (resultsRow && state.last10Results.length > 0) {
      var html = ""
      for (var i = 0; i < state.last10Results.length; i++) {
        var result = state.last10Results[i]
        var num = result.result_number
        var color = getColorFromNumber(num)
        html += '<div class="result-ball ' + color.toLowerCase() + '">' + num + "</div>"
      }
      resultsRow.innerHTML = html
    }

    // Update prediction card
    var predictionCard = document.getElementById("prediction-card")
    if (predictionCard && state.history.length > 0) {
      var latest = state.history[0]
      var levelClass = "level-" + (latest.predictionData ? latest.predictionData.level : 1)
      var predClass = latest.prediction === "BIG" ? "big" : "small"
      var nextBet = calculateBetAmount(bettingState.currentLevel)

      predictionCard.innerHTML =
        '\
        <div class="section-title">Current Prediction</div>\
        <span class="level-badge ' +
        levelClass +
        '">LEVEL ' +
        (latest.predictionData ? latest.predictionData.level : 1) +
        '</span>\
        <div class="current-prediction ' +
        predClass +
        '">' +
        latest.prediction +
        '</div>\
        <div style="color: #94a3b8; font-size: 14px;">For Issue: ' +
        latest.predictionForIssue.slice(-4) +
        '</div>\
        <div class="bet-config">\
          <div class="config-item">\
            <div class="config-label">Next Bet Amount</div>\
            <div class="config-value">' +
        nextBet +
        '</div>\
          </div>\
          <div class="config-item">\
            <div class="config-label">Current Level</div>\
            <div class="config-value">' +
        bettingState.currentLevel +
        "/4</div>\
          </div>\
        </div>\
      "
    }

    // Update history table
    var historyTbody = document.getElementById("history-tbody")
    if (historyTbody) {
      var historyHtml = ""
      var displayHistory = state.history.slice(0, 20)
      for (var j = 0; j < displayHistory.length; j++) {
        var item = displayHistory[j]
        var statusClass = item.result.toLowerCase()
        var betInfo = "-"

        // Find matching bet
        for (var k = 0; k < bettingState.betHistory.length; k++) {
          if (
            bettingState.betHistory[k].prediction === item.prediction &&
            Math.abs(new Date(bettingState.betHistory[k].timestamp) - new Date(item.timestamp)) < 10000
          ) {
            betInfo = bettingState.betHistory[k].amount
            break
          }
        }

        historyHtml +=
          "\
          <tr>\
            <td>" +
          item.predictionForIssue.slice(-4) +
          '</td>\
            <td style="color: ' +
          (item.prediction === "BIG" ? "#22c55e" : "#ef4444") +
          '; font-weight: bold;">' +
          item.prediction +
          "</td>\
            <td>" +
          (item.resultNumber !== undefined ? item.resultNumber : "-") +
          "</td>\
            <td>" +
          betInfo +
          '</td>\
            <td><span class="status-badge ' +
          statusClass +
          '">' +
          item.result +
          "</span></td>\
          </tr>\
        "
      }
      historyTbody.innerHTML = historyHtml
    }
  }

  // ============================================
  // MAIN PREDICTION CYCLE
  // ============================================

  function runCycle() {
    if (state.isRunning) return
    state.isRunning = true

    fetch(CONFIG.RESULTS_API + "?count=100&ts=" + Date.now())
      .then((response) => {
        if (!response.ok) throw new Error("API error: " + response.status)
        return response.json()
      })
      .then((data) => {
        var latestResults = data && data.success && data.data && data.data.results ? data.data.results : []

        if (latestResults.length === 0) {
          console.log("[BOT] No results from API")
          state.isRunning = false
          return
        }

        var currentResult = latestResults[0]
        var currentIssueNum = currentResult.issue_number
        var currentNumber = currentResult.result_number
        var nextIssueNum = (BigInt(currentIssueNum) + BigInt(1)).toString()

        state.last10Results = latestResults.slice(0, 10)

        var hasChanges = false

        // Update pending predictions with results
        for (var i = 0; i < state.history.length; i++) {
          var item = state.history[i]
          if (item.result !== "PENDING" && item.result !== "SKIP") continue

          var resultMatch = null
          for (var j = 0; j < latestResults.length; j++) {
            if (latestResults[j].issue_number === item.predictionForIssue) {
              resultMatch = latestResults[j]
              break
            }
          }

          if (!resultMatch) continue

          hasChanges = true
          var actualNumber = resultMatch.result_number

          if (item.result === "SKIP") {
            state.history[i].resultNumber = actualNumber
            continue
          }

          var actualValue =
            item.predictionData && item.predictionData.predictedType === "SIZE"
              ? getSizeFromNumber(actualNumber)
              : getColorFromNumber(actualNumber)

          var newResult = actualValue === item.prediction ? "WIN" : "LOSE"
          state.history[i].result = newResult
          state.history[i].resultNumber = actualNumber

          // Resolve any pending bets
          if (BETTING_CONFIG.AUTO_BET_ENABLED) {
            for (var b = 0; b < bettingState.betHistory.length; b++) {
              if (bettingState.betHistory[b].status === "PENDING") {
                resolveBet(bettingState.betHistory[b].id, newResult)
                break
              }
            }
          }
        }

        // Check if already predicted for next issue
        var alreadyPredicted = false
        for (var k = 0; k < state.history.length; k++) {
          if (state.history[k].predictionForIssue === nextIssueNum && state.history[k].result !== "SKIP") {
            alreadyPredicted = true
            break
          }
        }

        if (alreadyPredicted) {
          if (hasChanges) {
            saveToStorage(state.history)
            updateUI()
            sendToTelegram()
          }
          state.isRunning = false
          return
        }

        // Generate new prediction
        var recentCompleted = state.history
          .filter((h) => (h.result === "WIN" || h.result === "LOSE") && h.prediction !== "SKIP")
          .slice(0, 10)
          .map((h) => ({ status: h.result }))

        var totalPredictions = state.history.filter((h) => h.result !== "SKIP").length

        var prediction = predictNextColor(latestResults.slice(0, 50), recentCompleted, totalPredictions)

        var newItem = {
          id: nextIssueNum + "-" + Date.now(),
          currentIssue: currentIssueNum,
          predictionForIssue: nextIssueNum,
          number: currentNumber,
          prediction: prediction.shouldPredict ? prediction.predictedValue : "SKIP",
          result: prediction.shouldPredict ? "PENDING" : "SKIP",
          reason: prediction.reason || "",
          timestamp: new Date().toISOString(),
          predictionData: prediction,
        }

        state.history.unshift(newItem)
        state.history = state.history.slice(0, CONFIG.MAX_HISTORY)
        state.lastProcessedIssue = nextIssueNum

        saveToStorage(state.history)
        saveLastProcessedIssue(nextIssueNum)

        // Auto place bet
        if (BETTING_CONFIG.AUTO_BET_ENABLED && prediction.shouldPredict) {
          placeBet(prediction.predictedValue, bettingState.currentLevel)
        }

        updateUI()
        sendToTelegram()

        console.log(
          "[BOT] New prediction: " +
            prediction.predictedValue +
            " for issue " +
            nextIssueNum.slice(-4) +
            " | Level: " +
            prediction.level,
        )
      })
      .catch((err) => {
        console.log("[BOT] Cycle error:", err)
      })
      .finally(() => {
        state.isRunning = false
      })
  }

  function sendToTelegram() {
    var recentCompleted = state.history
      .filter((h) => (h.result === "WIN" || h.result === "LOSE") && h.prediction !== "SKIP")
      .slice(0, 10)

    var consecutiveLosses = 0
    for (var i = 0; i < recentCompleted.length; i++) {
      if (recentCompleted[i].result === "LOSE") {
        consecutiveLosses++
      } else {
        break
      }
    }

    var currentLevel = consecutiveLosses >= 4 ? 1 : consecutiveLosses + 1

    var formattedPredictions = state.history.slice(0, 20).map((item) => ({
      number: item.predictionForIssue,
      prediction: item.prediction,
      result: item.result,
      resultNumber: item.resultNumber,
    }))

    sendPredictionToTelegram(formattedPredictions, currentLevel)
  }

  // ============================================
  // GLOBAL CONTROLS
  // ============================================

  window.botToggleAutoBet = () => {
    BETTING_CONFIG.AUTO_BET_ENABLED = !BETTING_CONFIG.AUTO_BET_ENABLED
    var statusEl = document.querySelector(".auto-bet-status")
    if (statusEl) {
      statusEl.className = "auto-bet-status " + (BETTING_CONFIG.AUTO_BET_ENABLED ? "active" : "inactive")
      statusEl.textContent = "AUTO BETTING: " + (BETTING_CONFIG.AUTO_BET_ENABLED ? "ACTIVE" : "INACTIVE")
    }
    console.log("[BOT] Auto betting: " + (BETTING_CONFIG.AUTO_BET_ENABLED ? "ENABLED" : "DISABLED"))
  }

  window.botClearHistory = () => {
    if (confirm("Are you sure you want to clear all history?")) {
      state.history = []
      state.lastProcessedIssue = ""
      bettingState.betHistory = []
      localStorage.removeItem("bot_prediction_history")
      localStorage.removeItem("bot_last_processed_issue")
      updateUI()
      console.log("[BOT] History cleared")
    }
  }

  window.botSetBalance = (amount) => {
    bettingState.currentBalance = amount
    BETTING_CONFIG.BALANCE = amount
    updateUI()
    console.log("[BOT] Balance set to: " + amount)
  }

  window.botSetBaseBet = (amount) => {
    BETTING_CONFIG.BASE_BET = amount
    console.log("[BOT] Base bet set to: " + amount)
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    console.log("[BOT] Lucifer Auto Bot initializing...")

    // Load saved state
    state.history = loadFromStorage()
    state.lastProcessedIssue = loadLastProcessedIssue()

    // Create UI
    createUI()

    // Start the prediction cycle
    runCycle()
    setInterval(runCycle, CONFIG.FETCH_INTERVAL)

    console.log("[BOT] Lucifer Auto Bot started!")
    console.log("[BOT] Commands: botToggleAutoBet(), botClearHistory(), botSetBalance(amount), botSetBaseBet(amount)")
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }
})()
