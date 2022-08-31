# tfjs-react-native-mmkv-storage

MMKV storage IO for [tfjs-react-native](https://github.com/tensorflow/tfjs/tree/master/tfjs-react-native) based on [react-native-mmkv](https://github.com/mrousavy/react-native-mmkv).

Alternative for tfjs built-in [asyncStorageIO](https://github.com/tensorflow/tfjs/blob/master/tfjs-react-native/src/async_storage_io.ts), which is based on [async-storage](https://github.com/react-native-async-storage/async-storage).

[![NPM version](https://img.shields.io/npm/v/tfjs-react-native-mmkv-storage.svg?style=flat-square)](https://npmjs.org/package/tfjs-react-native-mmkv-storage)
[![CI](https://github.com/paradite/tfjs-react-native-mmkv-storage/actions/workflows/node.js.yml/badge.svg)](https://github.com/paradite/tfjs-react-native-mmkv-storage/actions/workflows/node.js.yml)

Differences with tfjs built-in asyncStorageIO:

- Use filesystem instead of SQLite on Android to avoid [storage limits](https://react-native-async-storage.github.io/async-storage/docs/limits)
- Supposedly [faster](https://github.com/mrousavy/react-native-mmkv#benchmark)

## Install:

```bash
$ yarn add tfjs-react-native-mmkv-storage
```

## Usage

TODO

## Testing

Too complicated to setup.
