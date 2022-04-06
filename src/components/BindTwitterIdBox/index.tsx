import './index.less'
import React, { useState, useEffect } from 'react'
import {
  getTwitterId,
  getFacebookId,
  getUserAccount,
  MessageTypes,
  randomId,
  sendMessage,
  getTwitterBindResult,
  bindTwitterId,
  PLATFORM,
  BINDING_CONTENT_TITLE,
  IBindResultData,
  bindPost,
  
} from '@soda/soda-core'

import { message as Notification } from 'antd'

import Logo from '../../assets/images/logo.png'
import IconClose from '../../assets/images/icon-close.png'
import Button from '../Button'
import { newPostTrigger } from '../../utils/handleShare'

interface IProps {
  platform: PLATFORM
}
export default function BindTwitterIdBox(props: IProps) {
  const { platform } = props
  const [show, setShow] = useState(false)
  const [binding, setBinding] = useState<IBindResultData>()
  const [tid, setTid] = useState('')
  const [showConnect, setShowConnect] = useState(false)

  const createBindingPost = async (account: string, tid: string) => {
    const content = `${BINDING_CONTENT_TITLE}. My address: ${account}, My id: ${tid}`
    document.body.click()
    //@ts-ignore
    await navigator.clipboard.writeText(content)
    newPostTrigger()
    Notification.success(
      'The binding post is generated. Please tweet/post this message to pulish your binding relationship.'
    )
    setShow(false)
    // await pasteShareTextToEditor(content)
  }

  useEffect(() => {
    ;(async () => {
      const account = await getUserAccount()
      if (!account) {
        setShow(false)
        return
      }
      let tid = ''
      if (platform === PLATFORM.Twitter) {
        tid = await getTwitterId()
      } else if (platform === PLATFORM.Facebook) {
        tid = await getFacebookId()
      }
      setTid(tid)

      const bindResult = await getTwitterBindResult({
        addr: account,
        tid: tid
      })

      console.log('BindBox bindResult: ', bindResult)
      const _binding = bindResult.find((item) => item.platform === platform)
      setBinding(_binding)
      if (_binding && _binding.content_id) {
        setShow(false)
      } else {
        setShow(true)
        return
      }
    })()
  }, [])

  /**
   * create binding post and send
   * @param account user's address
   * @param tid  id of platform
   */

  const handleBind = async () => {
    const account = await getUserAccount()
    let tid = ''
    if (platform === PLATFORM.Twitter) {
      tid = await getTwitterId()
    } else if (platform === PLATFORM.Facebook) {
      tid = await getFacebookId()
    }

    // only need to send binding post
    // if (binding && !binding.content_id) {
    //   createBindingPost(account, tid);
    //   return;
    // }

    const message = platform + tid
    const msg = {
      type: MessageTypes.Sing_Message,
      request: {
        message,
        account
      }
    }
    const res: any = await sendMessage(msg)
    console.log('sign res: ', res)
    const params = {
      addr: account,
      tid: tid,
      sig: res.result,
      platform
    }
    const bindRes = await bindTwitterId(params)
    if (bindRes) {
      // Notification.success('Bind succeed!');
      setShow(false)
    } else {
      Notification.warning('Bind failed. Please try agin later.')
      return
    }
    createBindingPost(account, tid)

    // //Fixme: bind directly with fake content_id
    // await bindPost({
    //   addr: account,
    //   tid,
    //   platform,
    //   content_id: platform + '-' + randomId(),
    // });
    // Notification.success('Bind success');
    // setShow(false);
  }

  return (
    <div
      className="bind-container"
      style={{ display: show ? 'block' : 'none' }}>
      <img
        src={IconClose}
        className="icon-close"
        alt=""
        onClick={() => setShow(false)}
      />
      <p className="logo">
        <img src={Logo} alt="logo" />
      </p>

      {!binding && !showConnect && (
        <div>
          <p className="title">Check your {platform} username</p>
          <p className="user-id">
            <span>{tid}</span>
          </p>
          <div className="bind-btns">
            <Button
              type="primary"
              onClick={() => {
                setShowConnect(true)
              }}>
              Confirm
            </Button>
          </div>
          <p className="tips">
            Please confirm that this is the correct {platform} account{' '}
          </p>
        </div>
      )}
      {!binding && showConnect && (
        <div>
          <p className="title">
            Bind your {platform} account with your wallet.
          </p>
          <div className="bind-btns">
            <Button onClick={handleBind} type="primary">
              Connect
            </Button>
            <a
              className="btn-link"
              onClick={() => {
                setShow(false)
              }}>
              Not Now
            </a>
          </div>
        </div>
      )}
      {binding && !binding.content_id && (
        <div>
          <p className="title">You need to send post to finish the binding.</p>
          <div className="bind-btns">
            <button className="btn-primary" onClick={handleBind}>
              Send Post
            </button>
            <a
              onClick={() => {
                setShow(false)
              }}>
              Not Now
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
