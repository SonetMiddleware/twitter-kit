import { inputText, pasteText, pasteImage } from '@soda/soda-event-util'
import {
  hasEditor,
  hasFocus,
  isCompose,
  newPostButtonSelector,
  postEditorDraftContentSelector,
  untilElementAvailable
} from '../selector'
import { isMobileTwitter } from './utils'

export const delay = async (time: number) => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(null)
    }, time)
  })
}

const isTwitterApp = window.location.href.includes('twitter')

export const newPostTrigger = () => {
  if (isTwitterApp) {
    const newTweetBtn: HTMLElement = document.querySelector(
      '[data-testid="SideNav_NewTweet_Button"]'
    )!
    newTweetBtn.click()
  }
}

export const shareToEditor = async (content?: Array<string | Blob>) => {
  if (!content) return
  const interval = 500
  if (!isCompose() && !hasEditor()) {
    // open tweet window
    await untilElementAvailable(newPostButtonSelector())
    newPostButtonSelector().evaluate()!.click()
  }
  try {
    // get focus
    const i = postEditorDraftContentSelector()
    await untilElementAvailable(i, 10000)

    while (!hasFocus(i)) {
      i.evaluate()!.focus()
      await delay(interval)
    }
    console.debug('[twitter-hook] dispatch paste event.....')
    for (const c of content) {
      if (!c) continue
      if (typeof c === 'string') {
        if (isMobileTwitter) {
          await inputText(c)
        } else {
          await pasteText(c)
        }
      } else {
        const arr = new Uint8Array(await new Response(c).arrayBuffer())
        await pasteImage(arr)
      }
    }
  } catch (e) {
    console.error('[twitter-hook] pasteToPostEditor: ', e)
  }
}
