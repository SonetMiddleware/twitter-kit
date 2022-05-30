import { regexMatch } from '@soda/soda-core'
import { defaultTo } from 'lodash-es'

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
