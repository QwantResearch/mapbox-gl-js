// @flow

import type {StyleSpecification} from '../../src/style-spec/types';
import Benchmark from '../lib/benchmark';
import fetchStyle from '../lib/fetch_style';
import TileParser from '../lib/tile_parser';
import {OverscaledTileID} from '../../src/source/tile_id';

export default class Layout extends Benchmark {
    tiles: Array<{tileID: OverscaledTileID, buffer: ArrayBuffer}>;
    parsers: Array<TileParser>;
    style: string | StyleSpecification;
    tileIDs: Array<OverscaledTileID>;

    constructor(style: string | StyleSpecification, tileIDs: ?Array<OverscaledTileID>) {
        super();
        this.style = style;
        this.tileIDs = tileIDs || [
            new OverscaledTileID(12, 0, 12, 655, 1583),
            new OverscaledTileID(8, 0, 8, 40, 98),
            new OverscaledTileID(4, 0, 4, 3, 6),
            new OverscaledTileID(0, 0, 0, 0, 0)
        ];
    }

    setup(): Promise<void> {
        return fetchStyle(this.style)
            .then((styleJSON) => {
                const sources = Object.keys(styleJSON.sources);
                this.parsers = sources.map((source) => (new TileParser(styleJSON, source)));
                const promises = this.parsers.map(parser => parser.setup());
                return Promise.all(promises);
            })
            .then(() => {
                const promises = [];
                for (const tileID of this.tileIDs) {
                    for (const parser of this.parsers) {
                        promises.push(parser.fetchTile(tileID));
                    }
                }
                return Promise.all(promises);
            })
            .then((tiles) => {
                this.tiles = tiles;
                // parse tiles once to populate glyph/icon cache
                const promises = [];
                for (const tile of tiles) {
                    for (const parser of this.parsers) {
                        promises.push(parser.parseTile(tile));
                    }
                }
                return Promise.all(promises);
            })
            .then(() => {});
    }

    bench() {
        let promise = Promise.resolve();
        for (const tile of this.tiles) {
            promise = promise.then(() => {
                const promises = this.parsers.map((parser) => (parser.parseTile(tile)));
                return Promise.all(promises).then(() => {});
            });
        }
        return promise;
    }
}
