import * as Sentry from "@sentry/nextjs"
import NextErrorComponent from "next/error"

import type { NextPage } from "next"
import type { ErrorProps } from "next/error"

const CustomErrorComponent: NextPage<ErrorProps> = (props) => {
  return <NextErrorComponent statusCode={props.statusCode} />
}

CustomErrorComponent.getInitialProps = async (contextData) => {
  await Sentry.captureUnderscoreErrorException(contextData)

  return NextErrorComponent.getInitialProps(contextData)
}

export default CustomErrorComponent