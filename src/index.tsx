import './style.less'
import React from 'react'
import * as PubSub from 'pubsub-js'
import * as ReactDOM from 'react-dom'
import * as Selectors from './selector'
import {
  MutationObserverWatcher,
  IntervalWatcher
} from '@dimensiondev/holoflows-kit'
import {
  startWatch,
  ResourceDialog,
  InlineTokenToolbar,
  InlineApplicationBindBox,
  saveLocal,
  CustomEventId,
  postShareHandler,
  removeTextInSharePost,
  dispatchPaste
} from '@soda/soda-core-ui'
import {
  getAddress,
  bind2WithWeb2Proof,
  matchBindingPattern,
  getBindResult,
  renderTokenFromCacheMedia,
  BindInfo,
  registerApplication
} from '@soda/soda-core'
import Logo from './assets/images/logo.png'
import {
  untilElementAvailable,
  postsImageSelector,
  postsContentSelector
} from './selector'
import { postIdParser } from './utils/posts'

import { message } from 'antd'
import { newPostTrigger, pasteShareTextToEditor } from './utils/handleShare'
import { getTwitterId, StorageKeys } from './utils/utils'
import { getUserID } from './utils/posts'

export const APP_NAME = 'Twitter'
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

let binding: BindInfo
async function getBindingContent() {
  if (binding) return binding
  const address = await getAddress()
  const appid = await getTwitterId()
  const bindResult = await getBindResult({
    address,
    application: APP_NAME,
    appid
  })
  const _binding = bindResult.find((item) => item.application === APP_NAME)
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
  let globalBinding = false
  const postWatcher = new IntervalWatcher(postsContentSelector())
    .useForeach((node, _, proxy) => {
      const tweetNode = getTweetNode(node)
      if (!tweetNode) return
      function run() {
        collectPostInfo(tweetNode!)
        removeTextInSharePost(tweetNode!)
      }

      async function handleBindPost() {
        if (matchBindingPattern(tweetNode!.innerText)) {
          // FIXME: shall compare tweet host with appid
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
          const _binding = await getBindingContent()
          if (_binding && _binding.contentId === tweetId) {
            // already binded post
            return
          } else if (_binding && !_binding.contentId) {
            const address = await getAddress()
            const appid = await getTwitterId()
            if (authorId === appid && authorAddress === address) {
              const bindRes = await bind2WithWeb2Proof({
                address,
                appid,
                application: APP_NAME,
                contentId: tweetId
              })
              if (bindRes) message.success('Bind successful!')
            }
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
      // no qr code matched
      // console.error(err)
    })
}

const spanStyles =
  'position:absolute;padding:5px;right:0;top:0;text-align:center;background:#fff;z-index:2'
const className = 'plat-meta-span'

const handleTweetImg = async (imgEle: HTMLImageElement, username: string) => {
  const bgDiv = imgEle.previousElementSibling! as HTMLDivElement
  console.debug('[twitter-hook] image container: ', bgDiv)
  const imgSrc = imgEle.src
  console.debug('[twitter-hook] image source: ', imgSrc)
  if (imgSrc) {
    const res = await renderTokenFromCacheMedia(imgSrc, {
      dom: imgEle,
      config: { replace: true }
    })
    if (res && res.result) {
      bgDiv.style.display = 'none'
      imgEle.style.opacity = '1'
      imgEle.style.zIndex = '1'
      const dom: any = document.createElement('div')
      dom.style.cssText = spanStyles
      dom.className = className
      ReactDOM.render(
        <InlineTokenToolbar
          token={res.token}
          originMediaSrc={imgSrc}
          username={username}
          app={APP_NAME}
        />,
        dom
      )
      return dom
    }
  }
  return null
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
  console.debug('[twitter-hook] handleTwitterImg username: ', _username)

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
    if (dom) divParent?.appendChild(dom)
  }
  // })
}

const handleFullscreenTweetImgs = async () => {
  const imgEles =
    fullScreenImgWatcher.firstDOMProxy.realCurrent?.querySelectorAll(
      'img[draggable="true"]'
    )
  if (imgEles && imgEles.length > 0) {
    for (let i = 0; i < imgEles.length; i++) {
      const imgEle = imgEles[i] as HTMLImageElement
      const divParent = imgEle?.parentElement
      if (divParent) {
        const width = imgEle?.getBoundingClientRect().width
        if (width < 100) {
          continue
        }
        if (divParent.querySelector(`.${className}`)) {
          continue
        }
        const uesrname = window.location.pathname.split('/')[1]
        console.debug('[twitter-hook] fullScreenImage: ', width, uesrname)
        const dom = await handleTweetImg(imgEle, '@' + uesrname)
        divParent?.appendChild(dom)
      }
    }
  }
}

const bindBoxId = 'plattwin-bind-box'
let creatingBindBox = false

let watcher: any = null,
  topSidebarWatcher: any = null,
  nameWatcher: any = null,
  fullScreenImgWatcher: any = null,
  fullScreenImgLoadingWatcher: any = null,
  mainWatcher: any = null

const initWatcher = () => {
  watcher = new MutationObserverWatcher(
    Selectors.postEditorContentInPopupSelector()
  )
  topSidebarWatcher = new MutationObserverWatcher(
    Selectors.postEditorToolbarSelector()
  )
  // watch and add nickname
  nameWatcher = new MutationObserverWatcher(Selectors.twitterNickNameSelector())
  // watch fullscreen tweet image
  fullScreenImgWatcher = new MutationObserverWatcher(
    Selectors.tweetImageFullscreenSelector()
  )
  fullScreenImgLoadingWatcher = new MutationObserverWatcher(
    Selectors.tweetImageFullscreenLoadingSelector()
  )
  mainWatcher = new MutationObserverWatcher(Selectors.mainContentSelector())

  //@ts-ignore
  watcher.on('onAdd', () => {
    console.debug('[twitter-hook] onAdd: ', watcher.firstDOMProxy)
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

  //@ts-ignore
  topSidebarWatcher.on('onAdd', () => {
    if (watcher.firstDOMProxy.realCurrent) {
      //avoid two icons
      return
    }
    const toolBar = topSidebarWatcher.firstDOMProxy.realCurrent
    const dom = document.createElement('span')
    toolBar?.appendChild(dom)
    ReactDOM.render(<App />, dom)
  })

  //@ts-ignore
  nameWatcher.on('onAdd', async () => {
    //@ts-ignore
    const navLeft = nameWatcher.firstDOMProxy.current as HTMLAnchorElement
    const href = navLeft?.href // profile link
    if (href) {
      const userId = getUserID(href)
      const nickname = '@' + userId
      console.debug('[twitter-hook] app account: ', nickname)
      await saveLocal(StorageKeys.TWITTER_NICKNAME, nickname)
    }
  })
  //@ts-ignore
  fullScreenImgWatcher.on('onAdd', async () => {
    handleFullscreenTweetImgs()
  })

  //@ts-ignore
  fullScreenImgLoadingWatcher.on('onRemove', () => {
    handleFullscreenTweetImgs()
  })

  //@ts-ignore
  mainWatcher.on('onAdd', () => {
    if (creatingBindBox) {
      return
    } else {
      creatingBindBox = true
    }
    console.debug('[twitter-hook] mainDiv: ', mainWatcher.firstDOMProxy)
    const mainDiv: any = document.querySelector('[role=main]')
    // @ts-ignore
    mainDiv.style = 'position:relative'
    const dom: any = document.createElement('div')
    dom.id = bindBoxId
    dom.style = 'position:fixed;top:20px;right:20px;'
    mainDiv?.appendChild(dom)
    ReactDOM.render(<InlineApplicationBindBox app={APP_NAME} />, dom)
    mainWatcher.stopWatch()
  })
}

function main() {
  // initial call
  initWatcher()
  getAddress()
  getTwitterId()
  startWatch(watcher)
  startWatch(topSidebarWatcher)
  startWatch(nameWatcher)

  // render nft resources dialog
  const div = document.createElement('div')
  document.body.appendChild(div)
  ReactDOM.render(
    <ResourceDialog app={APP_NAME} publishFunc={pasteShareTextToEditor} />,
    div
  )

  collectPostImgs()
  startWatch(fullScreenImgWatcher)
  startWatch(fullScreenImgLoadingWatcher)

  if (!document.getElementById(bindBoxId)) {
    startWatch(mainWatcher)
  }

  //handle share on intial
  postShareHandler(APP_NAME)

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

function getUserPage(meta: { appid?: string }) {
  const { appid } = meta
  const host = getConfig().hostLeadingUrl
  return `${host}/${appid ? appid : ''}`
}
export function getConfig() {
  return {
    hostIdentifier: 'twitter.com',
    hostLeadingUrl: 'https://twitter.com',
    hostLeadingUrlMobile: 'https://mobile.twitter.com',
    icon: 'images/twitter.png'
  }
}

export const init = () => {
  registerApplication({
    name: APP_NAME,
    meta: {
      getAccount: getTwitterId,
      getUserPage,
      getConfig,
      newPostTrigger,
      pasteShareTextToEditor
    }
  })
}
