import React from 'react'
import { LoadingOutlined } from '@ant-design/icons'
import './index.less'
interface IButtonProps {
  type: 'primary' | 'secondary'
  [key: string]: any
}
export default (props: IButtonProps) => {
  const { type, children, className, loading, ...rest } = props
  return (
    <button {...rest} className={`btn-${type}  ${className}`}>
      {' '}
      {loading && <LoadingOutlined />}
      {type === 'primary' && <span>{children}</span>}
      {type !== 'primary' && children}
    </button>
  )
}
