# 关于 Haskell 类型定义

Haskell 中有三种有关类型定义的关键字，下面将分别对他们进行介绍。

<!--more-->

## `data`

`data` 的作用是定义新的类型构造器和数据构造器。

```haskell
data Bool = True | False

data Point = Point Int Int

data Tree a = Leaf a | Branch (Tree a) (Tree a)
```

`=` 左边，`Bool`、`Point` 和 `Tree` 为类型构造器；`=` 右边，`True` 与 `False`、`Point` 以及 `Leaf` 与 `Branch` 是数据构造器。类型构造器与数据构造器的名称可以相同，也可不同。一个类型可对应任意个数据构造器（没有也可以哦），即和类型或枚举。

所谓类型构造器约等于泛型类型，如 `Tree a` 相当于 `Tree<A>`，也就是说，`Tree` 本身是类型构造器，只有传入类型后才为完整类型。

类型构造器可有参数，也可无参，如 `Point` 既可以看作类型构造器也可以看作类型。

数据构造器用以创建实际变量，其使用与类型构造器类似，并且数据构造器就是普通函数。对于无参数的 `True` 与 `False`，既可以将其视为构造器/函数，也可以视作调用后的值，具体情况依上下文而定。对于有参数的构造器，定义时我们需要指定每个参数的类型，调用时则需用传入符合类型约束的实际值。

```haskell
point :: Point
point = Point 1 2

tree :: Tree Int
tree = Branch (Branch (Leaf 1) (Leaf 2)) (Leaf 3)
```

模式匹配语法与元组类似：

```haskell
add :: Point -> Point -> Point
Point x y `add` Point x' y' = Point (x + x') (y + y')

traverse :: Tree a -> [a]
traverse (Leaf x) = [x]
traverse (Branch l r) = traverse l ++ traverse r
```

## 记录

除了通过函数参数语法与参数前后位置来定义无名字段，我们还可以使用记录语法定义具名字段：

```haskell
data Point = Point {x :: Int, y :: Int}

data Tree a = Leaf {value :: a} | Branch {left :: Tree a, right :: Tree a}
```

赋值与调用：

```haskell
point :: Point
point = Point {x = 1, y = 2}

tree :: Tree Int
tree =
  Branch
    { left = Leaf {value = 1},
      right = Branch {left = Leaf {value = 2}, right = Leaf {value = 3}}
    }
```

模式匹配：

```haskell
add :: Point -> Point -> Point
Point {x = x, y = y} `add` Point {x = x', y = y'} = Point (x + x') (y + y')

traverse :: Tree a -> [a]
traverse Leaf {value = x} = [x]
traverse Branch {left = l, right = r} = traverse l ++ traverse r
```

实际上，记录语法只是一种语法糖，也就是说，对于使用记录语法定义的数据构造器，无论使用基于参数位置还是记录语法的方式对数据进行赋值调用亦或是模式匹配操作都是等价的。

唯有一点不同，在记录语法中定义的具名字段会污染全局作用域，上面的三个数据构造器会在全局作用域中创建以下函数：

```haskell
x :: Point -> Int
y :: Point -> Int

value :: Tree a -> a
left :: Tree a -> Tree a
right :: Tree a -> Tree a
```

在常见的编程语言中，我们往往使用 `.` 或 `->` 来访问记录中字段，而在 Haskell 中，除了使用模式匹配，如果想要直接访问字段，只能使用这些自动生成的函数来实现。

用函数访问还能理解，这样确实更加简洁，并且还能利用到函数的组合，但污染全局作用域又该如何解释？尤其是 Haskell 又缺乏访问控制机制，只能使用模块机制限制导入导出与可访问性，难不成要通过人为命名规范来减少冲突？简直可以和 C 的 `#include` 坐一桌了。😓

> **`Leaf Int` 是错误的**
>
> 在 Haskell 中，Hindley–Milner 类型系统的强大类型推导能力无处不在，但显式的类型注解却独立于实际代码。所以，身处实际代码中的数据构造器 `Leaf` 和身处类型系统的类型（构造器）`Int` 不可能放在一起，除了在 `data` 的数据构造器定义中，其含义为「定义一个名为 `Leaf` 的数据构造器，该构造器接收一个类型为 `Int` 的参数」。

> **语言差异**
>
> 你是否注意到，在 Haskell 中，数据构造器与字段访问函数一样，都位于顶级作用域，且都没有限定符。
>
> Rust 中枚举与 `data` 有着相似作用：
>
> ```rust
> enum Tree<A>{
>     Leaf(A),
>     Branch(Box<Tree<A>>, Box<Tree<A>>),
> }
> ```
>
> 只不过，当想要构造变量时，默认情况下需使用 `Tree::Leaf(1)` 而非 `Leaf(1)`，除非先 `use Tree::Leaf;`。
>
> Haskell 的方式更简洁，而 Rust 更规范，这就是语言设计思路的不同吧。

## `newtype`

从表面上看，`newtype` 作用于 `data` 类似，但只能定义**有且只有一个**数据构造器并且**有且只有一个**字段的类型。比如：

```haskell
newtype Bool = True | False
```

是非法的，因为它有两个数据构造器。再比如：

```haskell
newtype Point = Point Int Int
```

也是非法的，引入它有两个字段。

不过，

```haskell
newtype Point = Point (Int, Int)
```

是可以的，因为它只有一个名为 `Point` 的数据构造器，并且只有一个元组类型的字段。

那么为什么要强调有且只有一个？`newtype` 又有什么作用呢？一句话来说，`newtype` 创建的是类型检查上不同但运行时相同的类型。也就是说，对于上面的 `Point`，在类型检查器看来，`Point` 的确是一个新类型而不是二元整型元组，如果某个函数接收 `(Int, Int)` 类型的参数，但传递的却是 `Point` 类型，它就会报错，反之亦然。而在运行时和编译后二进制代码的角度来看，`Point` 并不存在，有的只是 `(Int, Int)`。也就是说，`newtype` 相比于 `data` 会少一层封装开销。

## `type`

`type` 就很简单了，它只是用来定义单纯的类型（构造器）别名，具体是类型本身还是构造器取决于别名本身是什么。

```haskell
type Point = (Int, Int)
```

无论从类型还是运行时的角度看，`Point` 就是一个单纯的 `(Int, Int)`，而不是一个独立的新类型，所以使用 `type` 也并不能定义新的数据构造器。
