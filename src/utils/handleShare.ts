import {
  dispatchCustomEvents,
  POST_SHARE_TEXT,
  pasteImageToActiveElements
} from '@soda/soda-core-ui'

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

export const isTwitterApp = window.location.href.includes('twitter')
export const isFacebookApp = window.location.href.includes('facebook')

export const newPostTrigger = () => {
  if (isTwitterApp) {
    const newTweetBtn: HTMLElement = document.querySelector(
      '[data-testid="SideNav_NewTweet_Button"]'
    )!
    newTweetBtn.click()
  }
}

export const pasteTextToPostEditor = async (text: string, img?: Blob) => {
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
    // paste
    if (isMobileTwitter) {
      dispatchCustomEvents(i.evaluate()!, 'input', text)
    } else {
      dispatchCustomEvents(i.evaluate()!, 'paste', text)
    }
    // if (img) {
    //   i.evaluate()!.focus()
    //   console.log('[extension-twitter] pasting img...', i.evaluate())
    //   await pasteImageToActiveElements(img)
    // }
  } catch (e) {
    console.error('[twitter-hook] pasteTextToPostEditor: ', e)
  }
}

export const pasteShareTextToEditor = async (str:string, img?: Blob) => {
  const text = str || POST_SHARE_TEXT
  // const text = POST_SHARE_TEXT
  await pasteTextToPostEditor(text, img)
}
