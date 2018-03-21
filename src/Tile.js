import * as THREE from 'three';
import * as geov from 'geov';
import tileProvider from './TileProvider';

export default class Tile {
    constructor(radius, zoom, size, col, row, width) {
        this.id = zoom + '-' + col + '-' + row;
        this.radius = radius;
        this.zoom = zoom;
        this.size = size;
        this.row = row;
        this.col = col;
        this.width = width;

        this.phiStart = row === 0 ? 0 : geov.MathUtils.HALFPI + Math.atan(((2 * row / size) - 1) * geov.MathUtils.PI);
        this.height = row === size - 1 ? geov.MathUtils.PI - this.phiStart :
            geov.MathUtils.HALFPI + Math.atan(((2 * (row + 1) / size) - 1) * geov.MathUtils.PI) - this.phiStart;

        this.url = tileProvider.getTileUrl(this.zoom, this.row, this.col);
        // this.load();
    }
    load() {
        if (this.state) return;

        if (!this.request) {
            this.request = new XMLHttpRequest();
            this.request.timeout = 10000; // time in milliseconds
        }

        const _this = this;
        this.state = 'loading';
        this.request.open('GET', this.url, true);
        this.request.responseType = 'blob';
        this.request.onload = function () {
            const blob = this.response;
            const img = document.createElement('img');
            img.onload = function (e) {
                window.URL.revokeObjectURL(img.src); // 清除释放

                _this.heightSegments = Math.max(12 - _this.zoom, 5);
                _this.widthSegments = _this.zoom < 5 ? 12 : 3;
                _this.geometry = new THREE.SphereBufferGeometry(_this.radius, _this.widthSegments, _this.heightSegments, _this.col * _this.width, _this.width, _this.phiStart, _this.height);

                if (_this.zoom < 12 && _this.row > 0 && _this.row < _this.size - 1) {
                    _this.geometry.removeAttribute('uv');
                    const _mphiStart = Math.tan(_this.phiStart - geov.MathUtils.HALFPI) / 2;
                    const _mphiEnd = Math.tan(_this.phiStart + _this.height - geov.MathUtils.HALFPI) / 2;
                    const quad_uvs = [];
                    for (let heightIndex = 0; heightIndex <= _this.heightSegments; heightIndex++) {
                        const _phi = _this.phiStart + (heightIndex / _this.heightSegments * _this.height);
                        const _mphi = Math.tan(_phi - geov.MathUtils.HALFPI) / 2;
                        const _y = (_mphiEnd - _mphi) / (_mphiEnd - _mphiStart);
                        for (let widthIndex = 0; widthIndex <= _this.widthSegments; widthIndex++) {
                            quad_uvs.push(widthIndex / _this.widthSegments);
                            quad_uvs.push(_y);
                        }
                    }
                    _this.geometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(quad_uvs), 2));
                }
                _this.texture = new THREE.Texture();
                _this.texture.image = img;
                _this.texture.format = THREE.RGBFormat;
                _this.texture.needsUpdate = true;

                _this.material = new THREE.MeshLambertMaterial({
                    map: _this.texture,
                    side: THREE.FrontSide
                });
                _this.mesh = new THREE.Mesh(
                    _this.geometry,
                    _this.material
                );
                _this.mesh.tileId = _this.id;
                _this.state = 'loaded';
            };

            img.src = window.URL.createObjectURL(blob);
        };
        this.request.ontimeout = function () {
            _this.state = null;
            console.warn('Tile [%s] time out', _this.id);
        };
        this.request.onerror = function () {
            _this.state = null;
        };
        this.request.send();
    }
    abort() {
        if (this.request) {
            this.request.abort();
            this.request = null;
        }
        this.state = null;
    }
    dispose() {
        this.abort();
        if (this.geometry)
            this.geometry.dispose();
        this.geometry = null;
        if (this.material) {
            this.material.dispose();
            this.texture.dispose();
            this.material = null;
            this.texture = null;
        }
        // this.mesh.dispose();
        this.mesh = null;
    }
};