import { IntervalWatcher, LiveSelector } from '@dimensiondev/holoflows-kit'

type E = HTMLElement

const querySelector = <T extends E, SingleMode extends boolean = true>(
  selector: string,
  singleMode: boolean = true
) => {
  const ls = new LiveSelector<T, SingleMode>().querySelector<T>(selector)
  return (singleMode ? ls.enableSingleMode() : ls) as LiveSelector<
    T,
    SingleMode
  >
}
const querySelectorAll = <T extends E>(selector: string) => {
  return new LiveSelector().querySelectorAll<T>(selector)
}

export const postEditorContentInPopupSelector: () => LiveSelector<
  E,
  true
> = () => querySelector<E>('[aria-labelledby="modal-header"][role="dialog"]')
export const mainContentSelector: () => LiveSelector<E, true> = () =>
  querySelector<E>('[role=main]')

export const postEditorToolbarSelector: () => LiveSelector<E, true> = () =>
  querySelector<E>('[data-testid="toolBar"] > div')

export const twitterNickNameSelector: () => LiveSelector<E, true> = () =>
  querySelector('nav[role="navigation"] a:nth-last-child(2)')
export const isCompose = () => globalThis.location.pathname.includes('compose')

export const postEditorInPopupSelector: () => LiveSelector<E, true> = () =>
  querySelector<E>(
    '[aria-labelledby="modal-header"] > div:first-child > div:nth-child(3) > div:first-child > div:first-child [role="button"][aria-label]:nth-child(6)'
  )
export const toolBoxInSideBarSelector: () => LiveSelector<E, true> = () =>
  querySelector<E>('[role="banner"] [role="navigation"] > div')
export const postEditorInTimelineSelector: () => LiveSelector<E, true> = () =>
  querySelector<E>(
    '[role="main"] :not(aside) > [role="progressbar"] ~ div [role="button"][aria-label]:nth-child(6)'
  )
export const postEditorDraftContentSelector = () => {
  if (location.pathname === '/compose/tweet') {
    return querySelector<HTMLDivElement>(
      `[contenteditable][aria-label][spellcheck],textarea[aria-label][spellcheck]`
    )
  }
  return (
    isCompose() ? postEditorInPopupSelector() : postEditorInTimelineSelector()
  ).querySelector<HTMLElement>(
    '.public-DraftEditor-content, [contenteditable][aria-label][spellcheck]'
  )
}

export const hasEditor = () => !!postEditorDraftContentSelector().evaluate()
export const newPostButtonSelector = () =>
  querySelector<E>('[data-testid="SideNav_NewTweet_Button"]')
export const hasFocus = (x: LiveSelector<HTMLElement, true>) =>
  x.evaluate() === document.activeElement

export const tweetImageFullscreenSelector: () => LiveSelector<E, true> = () =>
  querySelector<E>('[aria-modal="true"][role="dialog"]')

export const tweetImageFullScreenListSelector: () => LiveSelector<
  E,
  true
> = () =>
  querySelector<E>('[aria-modal="true"][role="dialog"]').querySelectorAll(
    'li[role="listitem"]'
  )

export const tweetImageFullscreenLoadingSelector: () => LiveSelector<
  E,
  true
> = () => querySelector<E>('[aria-valuetext="Loading image"]')

export const untilElementAvailable = async (
  ls: LiveSelector<HTMLElement, boolean>,
  timeout = 5000
) => {
  const w = new IntervalWatcher(ls)
  return new Promise<void>((resolve, reject) => {
    setTimeout(() => reject(), timeout)
    w.useForeach(() => {
      w.stopWatch()
      resolve()
    }).startWatch(500)
  })
}

export const postsSelector = () =>
  querySelectorAll(
    [
      '#main_content .timeline .tweet', // legacy twitter
      '[data-testid="tweet"]' // new twitter
    ].join()
  )

export const postsImageSelector = (node: HTMLElement) =>
  new LiveSelector([node]).querySelectorAll<HTMLElement>(
    [
      '[data-testid="tweet"] > div > div img[src*="media"]', // image in timeline page for new twitter
      '[data-testid="tweet"] ~ div img[src*="media"]' // image in detail page for new twitter
    ].join()
  )

export const postsContentSelector = () =>
  querySelectorAll(
    [
      '.tweet-text > div', // both timeline and detail page for legacy twitter
      '[data-testid="tweet"] + div > div:first-child', // detail page for new twitter
      '[data-testid="tweet"] + div div[role="link"] div[lang]', // quoted tweet in detail page for new twitter
      '[data-testid="tweet"] > div:last-child div[role="link"] div[lang]' // quoted tweet in timeline page for new twitter
    ].join()
  ).concat(
    querySelectorAll('[data-testid="tweet"] > div:last-child').map((x) => {
      const textElement = x
        .querySelector('[role="group"]')
        ?.parentElement?.querySelector('div[lang]') as
        | HTMLDivElement
        | undefined

      if (textElement) return textElement

      // There's no textElement as there's only a twitter summary card parsed by a single url.
      const summaryCardElement = x
        .querySelector('[role="group"]')
        ?.parentElement?.querySelector('[data-testid="card.wrapper"]')
        ?.previousElementSibling as HTMLDivElement | undefined

      // return summaryCardElement;
      return x
    }) // timeline page for new twitter
  )
