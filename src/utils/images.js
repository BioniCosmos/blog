'use strict'

hexo.extend.filter.register('after_post_render', data => {
    data.content = processImgAttr(data.content)
})

function processImgAttr(content) {
    return content.replace(/<img src="(.*?)"(.*?)>/gi, (_str, src, other) => `<img src="/images/loading.png" class="lazy medium-zoom" data-src="${src}" ${other}>`)
}