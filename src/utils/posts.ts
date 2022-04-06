import { regexMatch } from '@soda/soda-core'
import { defaultTo, flattenDeep } from 'lodash-es'

/**
 * @example
 * parseNameArea("TheMirror\n(●'◡'●)@1\n@MisakaMirror")
 * >>> {
 *      name: "TheMirror(●'◡'●)@1",
 *      handle: "MisakaMirror"
 * }
 */
const parseNameArea = (nameArea: string) => {
  const atIndex = nameArea.lastIndexOf('@')
  const name = nameArea.slice(0, atIndex).replace(/\n+/g, '')
  const handle = nameArea.slice(atIndex + 1).replace(/\n+/g, '')
  return name && handle
    ? {
        name,
        handle
      }
    : {
        name: '',
        handle: ''
      }
}

const parseId = (t: string) => {
  return regexMatch(t, /status\/(\d+)/, 1)!
}

const serializeToText = (node: ChildNode): string => {
  const snippets: string[] = []
  for (const childNode of Array.from(node.childNodes)) {
    if (childNode.nodeType === Node.TEXT_NODE) {
      if (childNode.nodeValue) snippets.push(childNode.nodeValue)
    } else if (childNode.nodeName === 'IMG') {
      const img = childNode as HTMLImageElement
      const matched =
        (img.getAttribute('src') ?? '').match(
          /emoji\/v2\/svg\/([\d\w]+)\.svg/
        ) ?? []
      if (matched[1])
        snippets.push(
          String.fromCodePoint(Number.parseInt(`0x${matched[1]}`, 16))
        )
    } else if (childNode.childNodes.length)
      snippets.push(serializeToText(childNode))
  }
  return snippets.join('')
}

const isMobilePost = (node: HTMLElement) => {
  return (
    node.classList.contains('tweet') ?? node.classList.contains('main-tweet')
  )
}

export const postIdParser = (node: HTMLElement) => {
  if (isMobilePost(node)) {
    const idNode = node.querySelector<HTMLAnchorElement>('.tweet-text')
    return idNode ? idNode.getAttribute('data-id') ?? undefined : undefined
  } else {
    const idNode = defaultTo(
      node.children[1]?.querySelector<HTMLAnchorElement>('a[href*="status"]'),
      defaultTo(
        node.parentElement!.querySelector<HTMLAnchorElement>(
          'a[href*="status"]'
        ),
        node
          .closest('article > div')
          ?.querySelector<HTMLAnchorElement>('a[href*="status"]')
      )
    )
    const isRetweet = !!node.querySelector('[data-testid=socialContext]')
    const pid = idNode ? parseId(idNode.href) : parseId(location.href)
    // You can't retweet a tweet or a retweet, but only cancel retweeting
    return isRetweet ? `retweet:${pid}` : pid
  }
}
export const postAvatarParser = (node: HTMLElement) => {
  if (isMobilePost(node)) {
    const avatarElement = node.querySelector<HTMLImageElement>('.avatar img')
    return avatarElement ? avatarElement.src : undefined
  } else {
    const tweetElement = node.querySelector('[data-testid="tweet"]') ?? node
    const avatarElement =
      tweetElement.children[0].querySelector<HTMLImageElement>(
        `img[src*="twimg.com"]`
      )
    return avatarElement ? avatarElement.src : undefined
  }
}

export const postContentParser = (node: HTMLElement) => {
  if (isMobilePost(node)) {
    const containerNode = node.querySelector('.tweet-text > div')
    if (!containerNode) return ''
    return Array.from(containerNode.childNodes)
      .map((node) => {
        if (node.nodeType === Node.TEXT_NODE) return node.nodeValue
        if (node.nodeName === 'A')
          return (node as HTMLAnchorElement).getAttribute('title')
        return ''
      })
      .join(',')
  } else {
    const select = <T extends HTMLElement>(selectors: string) => {
      const lang = node.parentElement!.querySelector<HTMLDivElement>('[lang]')
      return lang ? Array.from(lang.querySelectorAll<T>(selectors)) : []
    }
    const sto = [
      ...select<HTMLAnchorElement>('a').map((x) => x.textContent),
      ...select<HTMLSpanElement>('span').map((x) => x.innerText)
    ]
    return sto.filter(Boolean).join(' ')
  }
}

// more about twitter photo url formating: https://developer.twitter.com/en/docs/tweets/data-dictionary/overview/entities-object#photo_format
export const canonifyImgUrl = (url: string) => {
  const parsed = new URL(url)
  if (parsed.hostname !== 'pbs.twimg.com') {
    return url
  }
  const { searchParams } = parsed
  searchParams.set('name', 'orig')
  // we can't understand original image format when given url labeled as webp
  if (searchParams.get('format') === 'webp') {
    searchParams.set('format', 'png')
    const pngURL = parsed.href
    searchParams.set('format', 'jpg')
    const jpgURL = parsed.href
    return [pngURL, jpgURL]
  }
  return parsed.href
}

export const postImagesParser = async (
  node: HTMLElement
): Promise<string[]> => {
  // TODO: Support steganography in legacy twitter
  if (isMobilePost(node)) return []
  const isQuotedTweet = !!node.closest('div[role="link"]')
  const imgNodes = node.querySelectorAll<HTMLImageElement>(
    'img[src*="twimg.com/media"]'
  )
  if (!imgNodes.length) return []
  const imgUrls = Array.from(imgNodes)
    .filter((node) => isQuotedTweet || !node.closest('div[role="link"]'))
    .flatMap((node) => canonifyImgUrl(node.getAttribute('src') ?? ''))
    .filter(Boolean)
  if (!imgUrls.length) return []
  return imgUrls
}
