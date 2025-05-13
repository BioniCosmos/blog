# Jetpack Compose 简介与 Android 开发初试

> Jetpack Compose 是用于构建原生 Android 界面的新工具包。它可简化并加快 Android 上的界面开发，使用更少的代码、强大的工具和直观的 Kotlin API，快速打造生动而精彩的应用。[^1]

<!--more-->

## 为什么使用 Compose？[^2][^3]

### 声明式

相比于命令式，声明式 API 更加直观，易于理解。

### 函数式

Compose 中，一切皆为普通函数，而非面向对象编程范式中的类。通过函数与函数之间的嵌套组合即可完成对 UI 的声明。代码量更少。

### 组合

组合能够避免继承所带来的诸多缺陷。

### Kotlin

得益于 Kotlin 强大的语法，加上 Compose 所使用的编程范式，无论是 UI 还是逻辑代码都使用 Kotlin 进行编写，无需拆分成 Kotlin/Java + XML 两部分。

### 可迁移性

Android View 与 Compose 可共存并互相引用。

### 兼容性

Compose 最低支持 API 21（Android 5.0），所以它能在大多数 Android 设备上使用。而 iOS 的 UI 框架 SwiftUI 只支持 iOS 13 及以上的版本[^4]，对比之下 Compose 拥有良好的兼容性。

## 为什么要推出 Compose？

从 Android 1.0 beta 到如今的 Android 13 已走过 15 年[^5]，但直到 2021 年 Jetpack Compose 发布为止[^6]，其 UI 开发方式并没有发生太大变化，与现代 UI 开发方式严重脱节。此外，在多年的版本迭代中，代码过于复杂（简称「屎山」）。最重要的问题是**设计理念的落后**。

一个很经典的例子是 `Button` 类继承 `TextView` 类，看上去 `Button` 只是带有点击功能的 `TextView`，但 `TextView` 需要文本选中功能，`Button` 却不需要。这就是不合理的继承带来的问题。此外，父类的更新往往也会自动为子类引入不必要的功能。

## 命令式（How）对比声明式（What）

### Android View 对比 Compose

```kotlin
val text = findViewById<TextView>(R.id.textView)
val button = findViewById<Button>(R.id.button)
var count = 0
button.setOnClickListener {
    text.text = "${count++}"
}
```

```kotlin
Column {
    var count by remember { mutableStateOf(0) }
    Text(text = "$count")
    Button(onClick = { count++ }) {
        Text(text = "+1")
    }
}
```

### Vanilla JS 对比 React/Vue

```typescript
const text = document.getElementById('text')!
const button = document.getElementById('button')!
let count = 0
button.addEventListener('click', () => {
  text.textContent = `${count++}`
})
```

```tsx
export default function Counter() {
  const [count, setcount] = useState(0)
  return (
    <>
      <div>{count}</div>
      <button onClick={() => setcount(count + 1)}>+1</button>
    </>
  )
}
```

```vue
<script setup lang="ts">
const count = ref(0)
</script>

<template>
  <div>{{ count }}</div>
  <button @click="() => count++">+1</button>
</template>
```

看起来命令式代码并不是太长，但这些代码仅仅描述了逻辑，仍需通过 XML 或 HTML 描述 UI。而声明式将逻辑与 UI 放在一起，更加直观，尤其是 Compose，得益于 Kotlin 函数最后一个参数为 Lambda 类型的语法特性，仅仅使用 Kotlin 一种语言也能同时编写逻辑和 UI 代码。

## Android 开发实操

这个程序基于 [Compose 官方入门教程](https://developer.android.com/jetpack/compose/tutorial)，可以通过 API 展示[这篇文章](https://moecm.com/dynamic-memory-and-linear-structures-in-c-intro/)的评论，图片（头像）请求使用 [Coil](https://coil-kt.github.io/coil/)，其他网络请求使用 [OkHttp](https://square.github.io/okhttp/)，JSON 解析使用 [Kotlin serialization](https://github.com/Kotlin/kotlinx.serialization)。

### 问题

1. 使用网络需标注网络权限 `android.permission.INTERNET`，也就是在 `AndroidManifest.xml` 中添加 `<uses-permission android:name="android.permission.INTERNET" />`。
2. 禁止在主线程上执行网络操作，否则会抛出异常 `android.os.NetworkOnMainThreadException`。[^7]解决方法是使用 OkHttp 提供的异步请求，但它只提供回调函数的写法，我们可以使用 `suspend` 函数将其改写。

```kotlin
suspend fun request(): T = suspendCoroutine { continuation ->
    …
    continuation.resume(…)
    …
    continuation.resumeWithException(…)
}
```

这与 JavaScript 中的 `Promise` 十分相似。

```typescript
async function request(): Promise<T> {
  return new Promise((resolve, reject) => {
    …
    resolve(…)
    …
    reject(…)
  })
}
```

`suspend` 和 `async` 函数的调用方式有所不同，JavaScript 需要通过 `await` 才能获取到函数的真正返回值，且不使用 `await` 也能调用函数；但 Kotlin 中可以直接获取，且 `suspend` 函数只能在协程或其他 `suspend` 函数中调用。

```kotlin
GlobalScope.launch {
    val req = request()
}
```

类似的，JavaScript 关键字 `await` 只能用在其他 `async` 函数或 JavaScript 模块中。

```typescript
const req = await request()
```

### 程序截图

![Wind-Comment Android 版](./wind-comment-android-screenshot.webp)

[源码与幻灯片](../files/wind-comment-compose.zip)

[^1]: [Jetpack Compose 界面应用开发工具包 - Android 开发者  |  Android Developers](https://developer.android.com/jetpack/compose)
[^2]: [为什么采用 Compose  |  Jetpack Compose  |  Android Developers](https://developer.android.com/jetpack/compose/why-adopt)
[^3]: [Jetpack Compose 从入门到实战 - 1. Jetpack Compose 是什么？_哔哩哔哩_bilibili](https://www.bilibili.com/video/BV1Nd4y1S7HR/)
[^4]: [Can we use the SwiftUI for every IOS app version?](https://developer.apple.com/forums/thread/682366)
[^5]: [Android - 维基百科，自由的百科全书](https://zh.wikipedia.org/zh-cn/Android)
[^6]: [Android Developers Blog: Jetpack Compose is now 1.0: announcing Android’s modern toolkit for building native UI](https://android-developers.googleblog.com/2021/07/jetpack-compose-announcement.html)
[^7]: [NetworkOnMainThreadException  |  Android Developers](https://developer.android.com/reference/kotlin/android/os/NetworkOnMainThreadException)
