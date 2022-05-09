import {
  getLocal,
  removeLocal,
  StorageKeys,
  mixWatermarkImg,
  generateQrCodeBase64,
  dispatchCustomEvents,
  isMobileTwitter,
  POST_SHARE_TEXT,
  decodeMetaData
} from '@soda/soda-core'

import { message } from 'antd'
import {
  hasEditor,
  hasFocus,
  isCompose,
  newPostButtonSelector,
  postEditorDraftContentSelector,
  untilElementAvailable
} from '../selector'

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

export const pasteTextToPostEditor = async (text: string) => {
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
  } catch (e) {
    console.log('>>>>>>>>>>', e)
  }
}

export const pasteShareTextToEditor = async (str?: string) => {
  const text = str || POST_SHARE_TEXT
  await pasteTextToPostEditor(text)
}

const shareHandler = async () => {
  try {
    const meta = await getLocal(StorageKeys.SHARING_NFT_META)
    if (!meta) return
    const metaData = await decodeMetaData(meta)
    const { source, tokenId } = metaData
    console.log('shareHandler: ', source, tokenId)
    const imgUrl = source
    const qrcode = await generateQrCodeBase64(meta)
    if (meta && tokenId) {
      const [imgDataUrl, imgDataBlob] = await mixWatermarkImg(imgUrl, qrcode)
      const clipboardData = []
      newPostTrigger()
      message.success(
        'The resource has been saved to the clipboard. Paste to proceed share.'
      )
      // 触发document focus
      document.body.click()

      await pasteShareTextToEditor()
      // clear clipboard
      navigator.clipboard.writeText('')
      //@ts-ignore
      clipboardData.push(new ClipboardItem({ 'image/png': imgDataBlob }))

      //@ts-ignore
      await navigator.clipboard.write(clipboardData)

      await removeLocal(StorageKeys.SHARING_NFT_META)
    }
  } catch (err) {
    console.log(err)
  }
}

export default shareHandler
