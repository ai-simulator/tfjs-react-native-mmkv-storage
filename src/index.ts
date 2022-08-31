/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import { MMKV } from 'react-native-mmkv';
import { io } from '@tensorflow/tfjs-core';
import { fromByteArray, toByteArray } from 'base64-js';

type StorageKeys = {
  info: string;
  modelArtifactsWithoutWeights: string;
  weightData: string;
};

const PATH_SEPARATOR = '/';
const PATH_PREFIX = 'tensorflowjs_models';
const INFO_SUFFIX = 'info';
const MODEL_SUFFIX = 'model_without_weight';
const WEIGHT_DATA_SUFFIX = 'weight_data';

function getModelKeys(path: string): StorageKeys {
  return {
    info: [PATH_PREFIX, path, INFO_SUFFIX].join(PATH_SEPARATOR),
    modelArtifactsWithoutWeights: [PATH_PREFIX, path, MODEL_SUFFIX].join(
      PATH_SEPARATOR
    ),
    weightData: [PATH_PREFIX, path, WEIGHT_DATA_SUFFIX].join(PATH_SEPARATOR),
  };
}
/**
 * Populate ModelArtifactsInfo fields for a model with JSON topology.
 * @param modelArtifacts
 * @returns A ModelArtifactsInfo object.
 */
function getModelArtifactsInfoForJSON(
  modelArtifacts: io.ModelArtifacts
): io.ModelArtifactsInfo {
  if (modelArtifacts.modelTopology instanceof ArrayBuffer) {
    throw new Error('Expected JSON model topology, received ArrayBuffer.');
  }

  return {
    dateSaved: new Date(),
    // TODO followup on removing this from the the interface
    modelTopologyType: 'JSON',
    weightDataBytes:
      modelArtifacts.weightData == null
        ? 0
        : modelArtifacts.weightData.byteLength,
  };
}

class MMKVStorageHandler implements io.IOHandler {
  protected readonly keys: StorageKeys;
  protected mmkvStorage: MMKV;

  constructor(protected readonly modelPath: string) {
    if (modelPath == null || !modelPath) {
      throw new Error('modelPath must not be null, undefined or empty.');
    }
    this.keys = getModelKeys(this.modelPath);
    // Leave path and id to default. Handle model id in save method.
    this.mmkvStorage = new MMKV();
  }

  /**
   * Save model artifacts to MMKVStorage
   *
   * @param modelArtifacts The model artifacts to be stored.
   * @returns An instance of SaveResult.
   */
  async save(modelArtifacts: io.ModelArtifacts): Promise<io.SaveResult> {
    if (modelArtifacts.modelTopology instanceof ArrayBuffer) {
      throw new Error(
        'MMKVStorageHandler.save() does not support saving model topology ' +
          'in binary format.'
      );
    } else {
      // We save three items separately for each model,
      // a ModelArtifactsInfo, a ModelArtifacts without weights
      // and the model weights.
      const modelArtifactsInfo: io.ModelArtifactsInfo =
        getModelArtifactsInfoForJSON(modelArtifacts);
      const { weightData, ...modelArtifactsWithoutWeights } = modelArtifacts;

      try {
        this.mmkvStorage.set(
          this.keys.info,
          JSON.stringify(modelArtifactsInfo)
        );
        this.mmkvStorage.set(
          this.keys.modelArtifactsWithoutWeights,
          JSON.stringify(modelArtifactsWithoutWeights)
        );
        this.mmkvStorage.set(
          this.keys.weightData,
          fromByteArray(new Uint8Array(weightData as ArrayBuffer))
        );
        return { modelArtifactsInfo };
      } catch (err) {
        // If saving failed, clean up all items saved so far.
        this.mmkvStorage.delete(this.keys.info);
        this.mmkvStorage.delete(this.keys.weightData);
        this.mmkvStorage.delete(this.keys.modelArtifactsWithoutWeights);

        throw new Error(
          `Failed to save model '${this.modelPath}' to MMKVStorage.
              Error info ${err}`
        );
      }
    }
  }

  /**
   * Load a model from local storage.
   *
   * See the documentation to `browserLocalStorage` for details on the saved
   * artifacts.
   *
   * @returns The loaded model (if loading succeeds).
   */
  async load(): Promise<io.ModelArtifacts> {
    const info = JSON.parse(
      (await this.mmkvStorage.getString(this.keys.info)) || '{}'
    ) as io.ModelArtifactsInfo;
    if (info == null) {
      throw new Error(
        `In local storage, there is no model with name '${this.modelPath}'`
      );
    }

    if (info.modelTopologyType !== 'JSON') {
      throw new Error(
        'BrowserLocalStorage does not support loading non-JSON model ' +
          'topology yet.'
      );
    }

    const modelArtifacts: io.ModelArtifacts = JSON.parse(
      (await this.mmkvStorage.getString(
        this.keys.modelArtifactsWithoutWeights
      )) || '{}'
    );

    // Load weight data.
    const weightDataBase64 = await this.mmkvStorage.getString(
      this.keys.weightData
    );
    if (weightDataBase64 == null) {
      throw new Error(
        `In local storage, the binary weight values of model ` +
          `'${this.modelPath}' are missing.`
      );
    }
    modelArtifacts.weightData = toByteArray(weightDataBase64).buffer;

    return modelArtifacts;
  }
}

/**
 * Factory function for MMKVStorage IOHandler.
 *
 * This `IOHandler` supports both `save` and `load`.
 *
 * For each model's saved artifacts, three items are saved to mmkv storage.
 *   - `tensorflowjs_models/${modelPath}/info`: Contains meta-info about the
 *     model, such as date saved, type of the topology, size in bytes, etc.
 *   - `tensorflowjs_models/${modelPath}/model_without_weight`: The topology,
 *     weights_specs and all other information about the model except for the
 *     weights.
 *   - `tensorflowjs_models/${modelPath}/weight_data`: Concatenated binary
 *     weight values, stored as a base64-encoded string.
 *
 * ```js
 *  async function mmkvStorageExample() {
 *    // Define a model
 *    const model = tf.sequential();
 *    model.add(tf.layers.dense({units: 5, inputShape: [1]}));
 *    model.add(tf.layers.dense({units: 1}));
 *    model.compile({loss: 'meanSquaredError', optimizer: 'sgd'});
 *
 *    // Save the model to mmkv storage
 *    await model.save(mmkvStorageIO('custom-model-test'));
 *    // Load the model from mmkv storage
 *    await tf.loadLayersModel(mmkvStorageIO('custom-model-test'));
 * }
 * ```
 *
 * @param modelPath A unique identifier for the model to be saved. Must be a
 *   non-empty string.
 * @returns An instance of `IOHandler`
 *
 * @doc {heading: 'Models', subheading: 'IOHandlers'}
 */
export function mmkvStorageIO(modelPath: string) {
  return new MMKVStorageHandler(modelPath);
}
