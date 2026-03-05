'use client'

import React, { useEffect, useRef } from 'react'
import { PublishButton, useLivePreviewContext, useDocumentInfo } from '@payloadcms/ui'

export const CustomPublishButton: React.FC<any> = (props) => {
    const { data } = useDocumentInfo()
    const prevUpdatedAt = useRef(data?.updatedAt)
    const { url: livePreviewURL, setURL: setLivePreviewURL } = useLivePreviewContext()
    const cachedURLRef = useRef(livePreviewURL)

    // Cache the Live Preview URL to restore it if Payload wrongly clears it on save drafts 
    // triggered by native hotkeys like cmd+s.
    useEffect(() => {
        if (livePreviewURL) {
            cachedURLRef.current = livePreviewURL
        } else if (!livePreviewURL && cachedURLRef.current) {
            const timeout = setTimeout(() => {
                if (cachedURLRef.current) {
                    setLivePreviewURL(cachedURLRef.current)
                }
            }, 50)
            return () => clearTimeout(timeout)
        }
    }, [livePreviewURL, setLivePreviewURL])

    useEffect(() => {
        if (data?.updatedAt && data.updatedAt !== prevUpdatedAt.current) {
            // Tell the preview iframe to refresh on publish
            setTimeout(() => {
                const iframes = document.querySelectorAll('iframe')
                iframes.forEach((iframe) => {
                    if (iframe.contentWindow) {
                        iframe.contentWindow.postMessage({ type: 'payload-update' }, '*')
                    }
                })
            }, 100)
        }
        prevUpdatedAt.current = data?.updatedAt
    }, [data?.updatedAt])

    return <PublishButton {...props} />
}

export default CustomPublishButton
