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
  postShareHandler,
  removeTextInSharePost
} from '@soda/soda-core-ui'
import {
  getAddress,
  bind2WithWeb2Proof,
  matchBindingPattern,
  getBindResult,
  renderTokenFromCacheMedia,
  BindInfo,
  registerApplication,
  traceTwitterForNFT
} from '@soda/soda-core'
import Logo from './assets/images/logo.png'
import {
  untilElementAvailable,
  postsImageSelector,
  postsContentSelector
} from './selector'
import { postIdParser } from './utils/posts'

import { message } from 'antd'
import { newPostTrigger, shareToEditor } from './utils/handleShare'
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

const handleTweetImg = async (imgEle: HTMLImageElement, userInfo: any) => {
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
      //trace nft tweet
      if (res.token && userInfo.tid) {
        const params = {
          // "chain_name": "",
          chainId: res.token.chainId,
          contract: res.token.contract,
          tokenId: res.token.tokenId!,
          info: userInfo
        }
        traceTwitterForNFT(params).then((res) => {
          console.log('[twitter-hook] trace tweet for nft res: ', res)
        })
      }
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
          username={userInfo.userId}
          app={APP_NAME}
        />,
        dom
      )
      return dom
    }
  }
  return null
}

let _twitterFullscreenImgSrc: string = ''
const handleFullScreenTweetImg = async (
  imgEle: HTMLImageElement,
  userInfo: any
) => {
  const bgDiv = imgEle.previousElementSibling! as HTMLDivElement
  console.debug('[twitter-hook] fullscreen image container: ', bgDiv)
  const imgSrc = imgEle.src
  if (_twitterFullscreenImgSrc === imgSrc) return
  _twitterFullscreenImgSrc = imgSrc
  console.debug('[twitter-hook] image source: ', imgSrc)
  if (imgSrc) {
    const res = await renderTokenFromCacheMedia(imgSrc, {
      dom: bgDiv,
      config: { extra: ['m3d'], css: 'width:100%;height:100%' }
    })
    if (res && res.result) {
      //trace nft tweet
      if (res.token && userInfo.tid) {
        const params = {
          chainId: res.token.chainId,
          contract: res.token.contract,
          tokenId: res.token.tokenId!,
          info: userInfo
        }
        traceTwitterForNFT(params).then((res) => {
          console.log('[twitter-hook] trace tweet for nft res: ', res)
        })
      }
      imgEle.style.display = 'none'
      const dom: any = document.createElement('div')
      dom.style.cssText = spanStyles
      dom.className = className
      ReactDOM.render(
        <InlineTokenToolbar
          token={res.token}
          originMediaSrc={imgSrc}
          username={userInfo.user_id}
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
  const img = tweetNode.querySelector('img')
  //@ts-ignore
  const tweet = tweetNode.querySelector('[data-testid="tweetText"]')?.innerText
  const info: any = {
    userImg: img?.src,
    username: aList[1].querySelectorAll('span')[1].innerText,
    content: tweet
  }
  let userId = ''
  for (const aItem of aList) {
    const spans = aItem.querySelectorAll('span')
    for (const spanItem of spans) {
      if (spanItem.innerText.startsWith('@')) {
        userId = spanItem.innerText
        info.userId = spanItem.innerText
        break
      }
    }
    if (userId) {
      break
    }
  }
  for (const aItem of aList) {
    if (userId && aItem.href.includes(`/${userId.substring(1)}/status/`)) {
      const str = `/${userId.substring(1)}/status/`
      const rest = aItem.href.substring(aItem.href.indexOf(str) + str.length)
      const contentId = rest.split('/')[0]
      info.tid = contentId
      return info
    }
  }
  return info
}

async function handleTwitterImg(tweetNode: any) {
  const userInfo = findTweetAuthorId(tweetNode)
  console.log('[twitter-kit] userinfo: ', userInfo)

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
    const dom = await handleTweetImg(imgEle, userInfo!)
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
        const info = {
          userId: '@' + uesrname
        }
        const dom = await handleFullScreenTweetImg(imgEle, info)
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
    _twitterFullscreenImgSrc = ''
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
  ReactDOM.render(<ResourceDialog shareCallback={shareToEditor} />, div)

  collectPostImgs()
  startWatch(fullScreenImgWatcher)
  startWatch(fullScreenImgLoadingWatcher)

  if (!document.getElementById(bindBoxId)) {
    startWatch(mainWatcher)
  }

  //handle share on intial
  postShareHandler(APP_NAME)
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
      shareToEditor
    }
  })
}
