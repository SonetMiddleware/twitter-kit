import './style.less'
import React from 'react'
import * as PubSub from 'pubsub-js'
import * as ReactDOM from 'react-dom'
import * as Selectors from './selector'
import { getChainId, startWatch, SUCCESS_CODE } from '@soda/soda-core'
import {
  MutationObserverWatcher,
  IntervalWatcher
} from '@dimensiondev/holoflows-kit'
import {
  ResourceDialog,
  ImgMask,
  BindTwitterIdBox,
  decodeQrcodeFromImgSrc,
  saveLocal,
  StorageKeys,
  CustomEventId,
  getTwitterId,
  removeTextInSharePost,
  dispatchPaste,
  bindPost,
  PLATFORM,
  BINDING_CONTENT_TITLE,
  getTwitterBindResult,
  IBindResultData,
  getUserAccount,
  decodeMetaData
} from '@soda/soda-core'
import { getStorageService } from '@soda/soda-storage-sdk'
import { getMediaTypes } from '@soda/soda-media-sdk'
import Logo from './assets/images/logo.png'
import {
  untilElementAvailable,
  postsImageSelector,
  postsContentSelector
} from './selector'
import { postIdParser } from './utils/posts'
import getAssetServices from '@soda/soda-asset'
import { getAppConfig } from '@soda/soda-package-index'

import { message } from 'antd'
import postShareHandler, { pasteShareTextToEditor } from './utils/handleShare'
import { getUserID } from './utils'

export const PLAT_TWIN_OPEN = 'PLAT_TWIN_OPEN'

function App() {
  return (
    <div
      className="icon-open-plattwin"
      onClick={() => {
        PubSub.publish(PLAT_TWIN_OPEN)
      }}>
      <img src={Logo} alt="" />
    </div>
  )
}

const watcher = new MutationObserverWatcher(
  Selectors.postEditorContentInPopupSelector()
)

//@ts-ignore
watcher.on('onAdd', () => {
  console.log(watcher.firstDOMProxy)
  if (watcher.firstDOMProxy.realCurrent) {
    const modal = watcher.firstDOMProxy.realCurrent
    const postEditorToolbar = modal.querySelector(
      '[data-testid="toolBar"] > div'
    )
    const dom = document.createElement('span')
    postEditorToolbar?.appendChild(dom)
    ReactDOM.render(<App />, dom)
  }
})
//@ts-ignore
watcher.on('onRemove', () => {})

const topSidebarWatcher = new MutationObserverWatcher(
  Selectors.postEditorToolbarSelector()
)

//@ts-ignore
topSidebarWatcher.on('onAdd', () => {
  if (watcher.firstDOMProxy.realCurrent) {
    //avoid two icons
    return
  }
  console.log('topSidebar: ', topSidebarWatcher.firstDOMProxy.realCurrent)
  const toolBar = topSidebarWatcher.firstDOMProxy.realCurrent
  const dom = document.createElement('span')
  toolBar?.appendChild(dom)
  ReactDOM.render(<App />, dom)
})

// watch and add nickname
const nameWatcher = new MutationObserverWatcher(
  Selectors.twitterNickNameSelector()
)

//@ts-ignore
nameWatcher.on('onAdd', async () => {
  //@ts-ignore
  const navLeft = nameWatcher.firstDOMProxy.current as HTMLAnchorElement
  const href = navLeft?.href // profile link
  if (href) {
    const userId = getUserID(href)
    const nickname = '@' + userId
    console.log('nickname: ', nickname)
    await saveLocal(StorageKeys.TWITTER_NICKNAME, nickname)
  }
})

let binding: IBindResultData
async function getBindingContent() {
  if (binding) return binding
  const addr = await getUserAccount()
  const tid = await getTwitterId()
  const bindResult = await getTwitterBindResult({
    addr,
    tid
  })
  const _binding = bindResult.find((item) => item.platform === PLATFORM.Twitter)
  if (_binding) {
    binding = _binding
    return binding
  }
}

function collectPostImgs() {
  const getTweetNode = (node: HTMLElement) => {
    return node.closest<HTMLDivElement>(
      [
        '.tweet',
        '.main-tweet',
        'article > div',
        'div[role="link"]' // retweet in new twitter
      ].join()
    )
  }
  const postWatcher = new IntervalWatcher(postsContentSelector())
    .useForeach((node, _, proxy) => {
      const tweetNode = getTweetNode(node)
      if (!tweetNode) return
      function run() {
        collectPostInfo(tweetNode!)
        removeTextInSharePost(tweetNode!)
      }

      async function handleBindPost() {
        const bindText = BINDING_CONTENT_TITLE
        if (tweetNode!.innerText.indexOf(bindText) > -1) {
          let tweetId = '',
            authorId = '',
            authorAddress = ''
          const tweetLinks = tweetNode!.querySelectorAll('a')
          for (let i = 0; i < tweetLinks.length; i++) {
            if (tweetLinks[i].href.includes('/status/')) {
              tweetId = tweetLinks[i].href
              const url = new URL(tweetId)
              authorId =
                '@' +
                url.pathname.replace(/^\//, '').replace(/\/$/, '').split('/')[0]
              authorAddress =
                tweetNode!.innerText.match(/(\b0x[a-fA-F0-9]{40}\b)/g)?.[0] ||
                ''
              break
            }
          }
          console.log('tweetId: ', tweetId)
          const _binding = await getBindingContent()

          const tid = await getTwitterId()
          const addr = await getUserAccount()
          if (_binding && _binding.content_id === tweetId) {
            // already binded post
            return
          } else if (
            _binding &&
            !_binding.content_id &&
            authorId === tid &&
            authorAddress === addr
          ) {
            console.log('handleBindPost')
            const bindRes = await bindPost({
              addr,
              tid,
              platform: PLATFORM.Twitter,
              content_id: tweetId
            })
            if (bindRes) {
              message.success('Bind successful!')
            }

            // window.location.reload();
          }
        }
      }
      handleBindPost()

      run()
      return {
        onTargetChanged: run,
        onRemove: () => {},
        onNodeMutation: run
      }
    })
    .assignKeys((node) => {
      const tweetNode = getTweetNode(node)
      const isQuotedTweet = tweetNode?.getAttribute('role') === 'link'
      return tweetNode
        ? `${isQuotedTweet ? 'QUOTED' : ''}${postIdParser(
            tweetNode
          )}${node.innerText.replace(/\s/gm, '')}`
        : node.innerText
    })
  postWatcher.startWatch(250)
}

function collectPostInfo(tweetNode: HTMLDivElement | null) {
  if (!tweetNode) return
  untilElementAvailable(postsImageSelector(tweetNode), 10000)
    .then(() => handleTwitterImg(tweetNode))
    .catch((err) => {
      console.log(err)
    })
}

const spanStyles =
  'position:absolute;padding:5px;right:0;top:0;text-align:center;background:#fff;z-index:2'
const className = 'plat-meta-span'

const handleTweetImg = async (imgEle: HTMLImageElement, username: string) => {
  const bgDiv = imgEle.previousElementSibling! as HTMLDivElement
  console.log('>>>>>bgdiv: ', bgDiv)
  const imgSrc = imgEle.src
  console.log('>>>>>>>>imgSRc: ', imgSrc)
  if (imgSrc) {
    let res
    try {
      res = await decodeQrcodeFromImgSrc(imgSrc)
    } catch (err) {
      console.log(err)
    }
    // console.log('qrcode res: ', res)
    let metaData: any = await decodeMetaData(res || '')
    const chainId = await getChainId()
    const assetService = getAppConfig(chainId).assetService as string[]
    const nft =
      //@ts-ignore
      await getAssetServices(assetService)[assetService[0]].getNFTFunc(metaData)
    const storageService = nft.storage || 'ipfs'
    const mediaType = nft.type || 'image'
    console.log('metaData: ', metaData)
    if (res) {
      if (
        metaData &&
        metaData.tokenId &&
        metaData.source &&
        typeof metaData.source === 'string'
      ) {
        const ipfsOrigin = metaData.source
        // bgDiv.style.backgroundImage = `url(${ipfsOrigin})` // blocked by CSP
        bgDiv.style.display = 'none'
        // imgEle.src = ipfsOrigin
        // imgEle.src = imgDataUrl;
        imgEle.style.opacity = '1'
        imgEle.style.zIndex = '1'
        //@ts-ignore
        const source = await getStorageService(storageService).loadFunc(
          nft.source,
          { uri: true }
        )

        if (source && source.startsWith && source.startsWith('http')) {
          //@ts-ignore
          getMediaTypes([mediaType])[mediaType].renderFunc(source, imgEle, {
            replace: true
          })
        }
      }
    }
    const dom: any = document.createElement('div')
    dom.style.cssText = spanStyles
    dom.className = className
    ReactDOM.render(
      <ImgMask meta={metaData} originImgSrc={imgSrc} username={username} />,
      dom
    )
    return dom
  }
}

const findTweetAuthorId = (tweetNode: HTMLDivElement) => {
  const aList = tweetNode.querySelectorAll('a')
  for (const aItem of aList) {
    const spans = aItem.querySelectorAll('span')
    for (const spanItem of spans) {
      if (spanItem.innerText.startsWith('@')) {
        return spanItem.innerText
      }
    }
  }
}

async function handleTwitterImg(tweetNode: any) {
  const _username = findTweetAuthorId(tweetNode)
  console.log('handleTwitterImg username: ', _username)

  const imgNodes = tweetNode.querySelectorAll(
    '[data-testid="tweet"] > div > div a[href*="photo"]'
  )
  // imgNodes.forEach(async (node: any) => {
  for (let i = 0; i < imgNodes.length; i++) {
    const node = imgNodes[i]
    const divParent = node.parentElement
    if (divParent.querySelector(`.${className}`)) {
      return
    }
    divParent.style.position = 'relative'
    const imgEle = node.querySelector('img[src*=media]') as HTMLImageElement
    const dom = await handleTweetImg(imgEle, _username!)
    divParent?.appendChild(dom)
  }
  // })
}

// watch fullscreen tweet image
const fullScreenImgWatcher = new MutationObserverWatcher(
  Selectors.tweetImageFullscreenSelector()
)
const fullScreenImgLoadingWatcher = new MutationObserverWatcher(
  Selectors.tweetImageFullscreenLoadingSelector()
)

const handleFullscreenTweetImgs = async () => {
  const imgEles =
    fullScreenImgWatcher.firstDOMProxy.realCurrent?.querySelectorAll(
      'img[draggable="true"]'
    )
  debugger
  if (imgEles && imgEles.length > 0) {
    for (let i = 0; i < imgEles.length; i++) {
      const imgEle = imgEles[i] as HTMLImageElement
      const divParent = imgEle?.parentElement
      if (divParent) {
        const width = imgEle?.getBoundingClientRect().width
        console.log('fullScreenImage: ', width)
        if (width < 100) {
          continue
        }
        if (divParent.querySelector(`.${className}`)) {
          continue
        }
        const uesrname = window.location.pathname.split('/')[1]
        console.log('fullScreenImg, ', uesrname)
        const dom = await handleTweetImg(imgEle, '@' + uesrname)
        divParent?.appendChild(dom)
      }
    }
  }
}
//@ts-ignore
fullScreenImgWatcher.on('onAdd', async () => {
  handleFullscreenTweetImgs()
})

//@ts-ignore
fullScreenImgLoadingWatcher.on('onRemove', () => {
  console.log('>>>>>>>listChange')
  handleFullscreenTweetImgs()
})

let creatingBindBox = false

// const mainWatcher = new MutationObserverWatcher(Selectors.postsSelector());
const mainWatcher = new MutationObserverWatcher(Selectors.mainContentSelector())
const bindBoxId = 'plattwin-bind-box'
//@ts-ignore
mainWatcher.on('onAdd', () => {
  if (creatingBindBox) {
    return
  } else {
    creatingBindBox = true
  }
  console.log('mainDiv: ', mainWatcher.firstDOMProxy)
  const mainDiv: any = document.querySelector('[role=main]')
  // @ts-ignore
  mainDiv.style = 'position:relative'
  const dom: any = document.createElement('div')
  dom.id = bindBoxId
  dom.style = 'position:fixed;top:20px;right:20px;'
  mainDiv?.appendChild(dom)
  ReactDOM.render(<BindTwitterIdBox platform={PLATFORM.Twitter} />, dom)
  mainWatcher.stopWatch()
})

function main() {
  // initial call
  getUserAccount()
  getTwitterId()
  startWatch(watcher)
  startWatch(topSidebarWatcher)
  startWatch(nameWatcher)

  // render nft resources dialog
  const div = document.createElement('div')
  document.body.appendChild(div)
  ReactDOM.render(<ResourceDialog publishFunc={pasteShareTextToEditor} />, div)

  collectPostImgs()
  startWatch(fullScreenImgWatcher)
  startWatch(fullScreenImgLoadingWatcher)

  if (!document.getElementById(bindBoxId)) {
    startWatch(mainWatcher)
  }

  //handle share on intial
  postShareHandler()

  const { apply } = Reflect
  document.addEventListener(CustomEventId, (e) => {
    const ev = e as CustomEvent<string>
    const [eventName, param, selector]: [keyof any, any[], string] = JSON.parse(
      ev.detail
    )
    switch (eventName) {
      case 'paste':
        return apply(dispatchPaste, null, param)

      default:
        console.error(eventName, 'not handled')
    }
  })
}

export default main
