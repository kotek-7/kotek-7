---
title: "VSCodeで快適なSTM32開発を！【新しくなった STM32 VSCode Extension】"
description: "STM32CubeIDE for VSCode を使って、VSCode で快適な STM32 開発環境を構築する方法を紹介します。"
pubDate: 2026-05-29
tags: ["STM32", "STM32CubeIDE", "C++", "VSCode"]
---

# コンセプト

- VSCode で STM32 開発
- C++ で書く
- 自前のプログラムは main.c に書かず、src ディレクトリに分離

# 𝑫𝒆𝒑𝒆𝒏𝒅𝒆𝒏𝒄𝒊𝒆𝒔

- STM32 CubeMX
- VSCode
- STM32 VSCode Extension v3.x

# 環境構築

## CubeMX のインストール

こちらから
https://www.st.com/ja/development-tools/stm32cubemx.html

## VSCode のインストール

こちらから
https://code.visualstudio.com/

## STM32CubeIDE for VSCode のインストール

VSCode の拡張機能パネルで
`STM32CubeIDE for Visual Studio Code`
を検索してインストール

![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1777479/e22be021-f126-4330-84b3-f34ee83f6681.png)

### ST-Link USB ドライバのインストール

1. VSCode の STM32CubeIDE パネルを開く
1. ST-Link USB Drivers を選択

![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1777479/b9b80686-dddb-4d72-8a9c-ef3cdc78453d.png)

# はじめよう

## HAL の雛形を作成

1. CubeMX でマイコンボード/自作基板の CubeMX プロジェクト (.ioc) を開きます (用意してください)
1. Project Manager → ToolChain/IDE を CMake にします ← 重要❗
1. 𝑮𝑬𝑵𝑬𝑹𝑨𝑻𝑬 𝑪𝑶𝑫𝑬 します

## VSCode で開く

1. 生成したプロジェクトを VSCode で開きます。
1. STM32Cube プロジェクトとしてセットアップするか聞かれるので、Yes を押してください。
   ![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1777479/837289e2-b098-4e98-8437-dbad2f3f8dbf.png)

1. 構成を聞かれたら Debug を押してください。
   ![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1777479/ac66cb91-9da1-460e-afaa-6d7aa271dccf.png)

これで最低限の開発環境ができました。ここからはさらに快適を求めてプロジェクトを改造していきます。

# プロジェクトを改造

## C++ に対応

CMakeLists.txt に以下を追加します。

```diff_cmake
cmake_minimum_required(VERSION 3.22)

#
# This file is generated only once,
# and is not re-generated if converter is called multiple times.
#
# User is free to modify the file as much as necessary
#

# Setup compiler settings
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS ON)

+ # 追加: C++ を有効化・設定
+ set(CMAKE_CXX_STANDARD 17)
+ set(CMAKE_CXX_STANDARD_REQUIRED ON)
+ set(CMAKE_CXX_EXTENSIONS OFF)

# Define the build type
if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE "Debug")
endif()

# Set the project name
set(CMAKE_PROJECT_NAME DRC-CCTL2026)

# Enable compile command to ease indexing with e.g. clangd
set(CMAKE_EXPORT_COMPILE_COMMANDS TRUE)

# Core project settings
project(${CMAKE_PROJECT_NAME})
message("Build type: " ${CMAKE_BUILD_TYPE})

- # Enable CMake support for ASM and C languages
- enable_language(C ASM)
+ # 追加: C++ の .cpp ファイルもビルド対象にする
+ enable_language(C CXX ASM)

# Create an executable object type
add_executable(${CMAKE_PROJECT_NAME})

# Add STM32CubeMX generated sources
add_subdirectory(cmake/stm32cubemx)

# Link directories setup
target_link_directories(${CMAKE_PROJECT_NAME} PRIVATE
    # Add user defined library search paths
)

# Add sources to executable
target_sources(${CMAKE_PROJECT_NAME} PRIVATE
    # Add user sources here
+    # 追加: 自前のコードをビルド対象にする
+    ${CMAKE_CURRENT_SOURCE_DIR}/src/app.cpp
)

# Add include paths
target_include_directories(${CMAKE_PROJECT_NAME} PRIVATE
+    # 追加: src をインクルードパスに追加
+    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

# Add project symbols (macros)
target_compile_definitions(${CMAKE_PROJECT_NAME} PRIVATE
    # Add user defined symbols
)

# Remove wrong libob.a library dependency when using cpp files
list(REMOVE_ITEM CMAKE_C_IMPLICIT_LINK_LIBRARIES ob)

# Add linked libraries
target_link_libraries(${CMAKE_PROJECT_NAME}
    stm32cubemx

    # Add user defined libraries
)

```

## src ディレクトリを作成

main.c の USER CODE BEGIN/END の間に書くのが嫌なので、main.c の変更は最小限にして、メインのソースコードを app.cpp に分離します。
app.cpp と app.h を追加します。

```diff
 .
 ├── cmake
 ├── Core
 ├── Drivers
+└── src/
+    ├── app.cpp
+    └── app.h
```

app.h に以下を追加

```cpp:app.h
#ifdef __cplusplus
extern "C" {
#endif

void setup();
void loop();

#ifdef __cplusplus
}
#endif
```

app.cpp に以下を追加

```cpp:app.cpp
#include "main.h"
#include "app.h"

extern "C" void setup() {
    // Initialize your application here
}

extern "C" void loop() {
    // Main application loop
    HAL_GPIO_TogglePin(LED_BI_GPIO_Port, LED_BI_Pin);
    HAL_Delay(500);
}
```

main.c に以下を追加

```diff_cpp:main.c
/* USER CODE BEGIN Includes */
+ #include "app.h"
/* USER CODE END Includes */

// 中略

  /* USER CODE BEGIN Init */
+  setup();
  /* USER CODE END Init */

// 中略

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
  while (1)
  {
+    loop();
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */
  }
  /* USER CODE END 3 */
```

:::note

### src にファイルを追加したいとき

src に 以下のようにモジュールを生やして app.cpp から include することは可能ですが、その際に CMakeLists.txt の target_sources に追加した cpp ファイルを足す必要があります。

```diff
.
└── src/
    ├── app.cpp
    ├── app.h
+   ├── buzzer.cpp
+   ├── buzzer.h
+   ├── lcd.cpp
+   └── lcd.h
```

```diff_cmake:CMakeLists.txt
target_sources(${CMAKE_PROJECT_NAME} PRIVATE
    # 追加: C++のコードをビルド対象にする
+   ${CMAKE_CURRENT_SOURCE_DIR}/src/lcd.cpp
+   ${CMAKE_CURRENT_SOURCE_DIR}/src/buzzer.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/app.cpp
)
```

:::

# ビルド・書き込み

1. 基板を用意します
1. STLINK で繋ぎます
1. VSCode で "実行とデバッグ" (Ctrl+Shift+D) パネルを開いて、実行とデバッグを押します。
   ![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1777479/94c938b6-389f-4b59-b3cf-cfff5f695be9.png)
1. デバッガーは `STM32Cube: STM32 Launch STLink GDB Server` を選択します。
   ![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1777479/e93dc4d8-b630-461e-a85e-c9e7ada99f86.png)
1. ビルドが走り、プログラムが書き込まれて以下の画面になります。
   HAL_Init(); で一時停止しているので、上の続行 > ボタンを押して続行してください。プログラムが動作を始めます。
   ![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1777479/b9d6153a-8651-4152-95d9-7d6d8b5f3270.png)

:::note warn

### 実行でエラーになるとき

![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1777479/031ff84f-595b-4797-bbc7-d0abb3cc95eb.png)

実行で↑のようなエラーになるときは、プロジェクトのセットアップをやり直してください。

1. STM32Cube パネルから `Set Up STM32Cube project(s)` を選択
   ![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1777479/73eb375c-863a-4adf-bbf7-aed5753c4434.png)
1. Configure を押す
   ![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1777479/e72c087c-0ed4-4b9d-8f8b-5e12b64fe25c.png)
1. 構成を聞かれたら Debug を選択
   ![image.png](https://qiita-image-store.s3.ap-northeast-1.amazonaws.com/0/1777479/ac66cb91-9da1-460e-afaa-6d7aa271dccf.png)

:::

# 開発フロー

1. CubeMX プロジェクトを作ったら、この記事の手順でセットアップ
1. プログラムを書く
1. ST-Link をつないで実行とデバッグ (F5) でビルド・書き込み
1. プログラムを変えたら、 Shift+F5 でデバッグを停止してから、再び F5 で再ビルド・書き込み

# 資料

- STM32CubeIDE for VSCode Guide
  https://dev.st.com/stm32cube-docs/stm32cubeide-vscode/1.0.1/en/index.html
