'use client';
import { useId } from 'react';
import { S } from '../strings.en';
import { Button, Dialog, Segmented, Switch } from './ui';
import { setFont, setMotion, setTheme, useSettings, type FontSize, type ThemePref } from '../lib/settings';

/** Display settings: changes apply at once and persist; there is no Save button [input-and-forms §31]. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();
  const id = useId();
  if (!s) return null;
  const motionSub = s.motion === 'device' ? S.reduceMotionDevice : s.reduced ? S.reduceMotionOn : S.reduceMotionOff;
  return (
    <Dialog open={open} onClose={onClose} title={S.settingsTitle} size="sm">
      <div className="settings">
        <div className="set-row">
          <span className="set-label" id={id + 't'}>{S.themeLabel}</span>
          <Segmented<ThemePref> label={S.themeLabel} value={s.theme} onChange={setTheme}
            options={[{ value: 'light', label: S.themeLight }, { value: 'dark', label: S.themeDark }, { value: 'system', label: S.themeSystem }]} />
        </div>
        <div className="set-row">
          <span className="set-label" id={id + 'f'}>{S.textSizeLabel}</span>
          <Segmented<FontSize> label={S.textSizeLabel} value={s.font} onChange={setFont}
            options={[{ value: 'small', label: S.textSmall }, { value: 'default', label: S.textDefault }, { value: 'large', label: S.textLarge }]} />
          <p className="set-preview" aria-label={S.previewLabel}>{S.previewText}</p>
        </div>
        <div className="set-row set-switch">
          <div className="row-body">
            <span className="set-label" id={id + 'm'}>{S.reduceMotionLabel}</span>
            <span className="row-sub" id={id + 'ms'}>{motionSub}</span>
          </div>
          <Switch checked={s.reduced} onChange={(v) => setMotion(v ? 'on' : 'off')} labelledBy={id + 'm'} describedBy={id + 'ms'} />
        </div>
        {s.motion !== 'device' ? (
          <Button kind="text" size="sm" className="set-reset" onClick={() => setMotion('device')}>{S.matchDevice}</Button>
        ) : null}
      </div>
    </Dialog>
  );
}
