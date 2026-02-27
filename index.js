require('dotenv').config()
const TelegramBot = require('node-telegram-bot-api')
const ytSearch = require('yt-search')
const { exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const token = process.env.BOT_TOKEN
const bot = new TelegramBot(token, { polling: true })

console.log("Professional Bot ishga tushdi 🚀")

// User session
let sessions = {}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id
  const text = msg.text

  if (!text || text === '/start') {
    return bot.sendMessage(chatId, "🎵 Qo'shiq yoki ijrochi nomini yozing")
  }

  try {
    await bot.sendMessage(chatId, "🔎 Qidiryapman...")

    const search = await ytSearch(text)
    const videos = search.videos

    if (!videos.length) {
      return bot.sendMessage(chatId, "❌ Hech narsa topilmadi")
    }

    sessions[chatId] = {
      results: videos,
      page: 0
    }

    sendPage(chatId)

  } catch (err) {
    console.log(err)
    bot.sendMessage(chatId, "❌ Xatolik yuz berdi")
  }
})

function sendPage(chatId) {
  const session = sessions[chatId]
  if (!session) return

  const start = session.page * 10
  const end = start + 10
  const pageResults = session.results.slice(start, end)

  let text = ""

  pageResults.forEach((v, i) => {
    let cleanTitle = v.title
      .replace(/\(.*?\)/g, '')
      .replace(/official/gi, '')
      .replace(/video/gi, '')
      .trim()

    text += `${i + 1}. ${cleanTitle} (${v.timestamp})\n`
  })

  const buttons = pageResults.map((_, i) => {
    return [{ text: `${i + 1}`, callback_data: `play_${start + i}` }]
  })

  const navRow = []

  if (session.page > 0)
    navRow.push({ text: "⬅ Prev", callback_data: "prev" })

  navRow.push({ text: "❌ Close", callback_data: "close" })

  if (end < session.results.length)
    navRow.push({ text: "Next ➡", callback_data: "next" })

  buttons.push(navRow)

  bot.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: buttons
    }
  })
}

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id
  const data = query.data

  if (!sessions[chatId]) return

  if (data === 'next') {
    sessions[chatId].page++
    return sendPage(chatId)
  }

  if (data === 'prev') {
    sessions[chatId].page--
    return sendPage(chatId)
  }

  if (data === 'close') {
    delete sessions[chatId]
    return bot.deleteMessage(chatId, query.message.message_id)
  }

  if (data.startsWith('play_')) {
    const index = parseInt(data.split('_')[1])
    const video = sessions[chatId].results[index]

    if (!video) return

    const fileName = `${Date.now()}.mp3`
    const filePath = path.join(__dirname, fileName)

    bot.sendMessage(chatId, "⬇️ Yuklanmoqda...")

    const command = `yt-dlp-x --audio-format mp3 --ffmpeg-location "${__dirname}" -o "${filePath}" "${video.url}"`

    exec(command, async (error) => {
      if (error) {
        console.log(error)
        return bot.sendMessage(chatId, "❌ Yuklab bo‘lmadi")
      }

      await bot.sendAudio(chatId, filePath, {
        title: video.title,
        performer: video.author.name
      })

      fs.unlinkSync(filePath)
    })
  }
})
