import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const GROW_MS = 450;
const SHRINK_MS = 260;
const CONTENT_FADE_MS = 180;
const STYLE_CLASS = 'golden-gate-island';

export default class GoldenGateIsland extends Extension {
    enable() {
        this._dateMenu = Main.panel.statusArea.dateMenu;
        const menu = this._menu = this._dateMenu.menu;
        this._origOpen = menu.open;
        this._origClose = menu.close;
        menu.box.add_style_class_name(STYLE_CLASS);

        menu.open = () => {
            if (menu.isOpen && !this._closing)
                return;
            this._closing = false;
            if (!menu.isOpen)
                this._origOpen.call(menu, BoxPointer.PopupAnimation.NONE);
            menu.box.remove_all_transitions();
            menu.box.opacity = 0;
            // The very first open gets its size and position over a few frames; grow only once it sits under the clock
            let framesLeft = 30;
            global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => {
                if (!menu.isOpen || this._closing)
                    return false;
                if (!this._menuIsPlaced() && framesLeft-- > 0)
                    return true;
                this._grow();
                return false;
            });
        };

        menu.close = () => {
            if (!menu.isOpen || !this._island) {
                this._finishClose();
                return;
            }
            if (this._closing)
                return;
            this._closing = true;
            menu.box.remove_all_transitions();
            menu.box.ease({opacity: 0, duration: CONTENT_FADE_MS / 2, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
            this._island.remove_all_transitions();
            this._island.ease({
                ...this._pillRect(),
                duration: SHRINK_MS,
                mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
                onComplete: () => {
                    if (this._closing)
                        this._finishClose();
                },
            });
        };
    }

    _pillRect() {
        const [x, y] = this._dateMenu._clockDisplay.get_transformed_position();
        const [width, height] = this._dateMenu._clockDisplay.get_transformed_size();
        return {x, y, width, height};
    }

    _menuIsPlaced() {
        const pill = this._pillRect();
        const [mx, my] = this._menu.box.get_transformed_position();
        const [mw, mh] = this._menu.box.get_transformed_size();
        const pillCenter = pill.x + pill.width / 2;
        return mw > 1 && mh > 1 && my >= pill.y && Math.abs(mx + mw / 2 - pillCenter) < mw / 2;
    }

    _grow() {
        const menu = this._menu;
        const pill = this._pillRect();
        const [mx, my] = menu.box.get_transformed_position();
        const [mw, mh] = menu.box.get_transformed_size();

        if (!this._island) {
            this._island = new St.Widget({style_class: 'golden-gate-island-shape', reactive: false, ...pill});
            // Below the top bar, so the real clock stays sharp on top of the growing island
            Main.layoutManager.uiGroup.insert_child_below(this._island, Main.layoutManager.panelBox);
        }

        this._island.remove_all_transitions();
        this._island.ease({
            x: mx, y: pill.y, width: mw, height: my + mh - pill.y,
            duration: GROW_MS,
            mode: Clutter.AnimationMode.EASE_OUT_QUART,
        });
        menu.box.ease({opacity: 255, delay: GROW_MS * 0.45, duration: CONTENT_FADE_MS, mode: Clutter.AnimationMode.EASE_OUT_QUAD});
    }

    _finishClose() {
        this._closing = false;
        this._island?.destroy();
        this._island = null;
        this._menu.box.remove_all_transitions();
        this._origClose.call(this._menu, BoxPointer.PopupAnimation.NONE);
        this._menu.box.opacity = 255;
    }

    disable() {
        const menu = this._menu;
        menu.open = this._origOpen;
        menu.close = this._origClose;
        if (menu.isOpen)
            this._origClose.call(menu, BoxPointer.PopupAnimation.NONE);
        this._island?.destroy();
        menu.box.remove_style_class_name(STYLE_CLASS);
        menu.box.remove_all_transitions();
        menu.box.opacity = 255;
        this._island = this._menu = this._dateMenu = this._origOpen = this._origClose = null;
        this._closing = false;
    }
}
