import { getLocal } from '@soda/soda-core-ui'
import { getConfig } from '..'

export enum StorageKeys {
  TWITTER_NICKNAME = 'TWITTER_NICKNAME',
  TWITTER_BINDED = 'TWITTER_BINDED',
  WAITING_TWITTER_BINDING_POST = 'WAITING_TWITTER_BINDING_POST',
  TWITTER_BIND_RESULT = 'TWITTER_BIND_RESULT'
}

let twitterIdGlobal = ''
export const getTwitterId = async () => {
  if (!twitterIdGlobal) {
    const twitterId = await getLocal(StorageKeys.TWITTER_NICKNAME)
    twitterIdGlobal = twitterId
  }
  return twitterIdGlobal
}

export const isMobileTwitter =
  location.hostname === getConfig().hostLeadingUrlMobile.substr(8) ||
  !!navigator.userAgent.match(/Mobile|mobile/)
export const twitterDomain = isMobileTwitter
  ? 'https://mobile.twitter.com/'
  : 'https://twitter.com/'
