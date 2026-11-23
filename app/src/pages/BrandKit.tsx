import { Icon } from '../components/Icon';
import { Panel } from '../components/ui';
import { HANDLES, REG_LINE, RISK_FULL, RISK_SHORT } from '../lib/constants';

const V = ({ ok, t }: { ok: boolean; t: string }) => <span className={`verified${ok ? '' : ' no'}`}><Icon name={ok ? 'check' : 'alert'} size={12} />{t}</span>;
const SW = ({ hex, name, src, ok = true }: { hex: string; name: string; src: string; ok?: boolean }) => (
  <div className="sw"><div className="c" style={{ background: hex }} /><div className="t"><b>{name}</b><code>{hex}</code><V ok={ok} t={src} /></div></div>
);

export function BrandKit() {
  return (
    <div className="page">
      <div className="page-head"><div><h1>Brand Kit</h1><p className="lead">Taken from abetglobal.com. Claude and the team use this for every script, design and video.</p></div>
        <div className="actions"><span className="chip st-warn"><Icon name="alert" size={13} />4 items need confirmation</span></div></div>
      <div className="bk-grid">
        <Panel icon="image" title="Logo" className="bk-full">
          <div className="logo-tiles">
            <div className="logo-tile"><div className="lt-v" style={{ background: '#fff' }}><img src="/brand/wordmark-dark.png" alt="ABET wordmark, dark" /></div><div className="lt-b"><b>Wordmark on light</b><V ok t="From the official white logo, recoloured" /></div></div>
            <div className="logo-tile"><div className="lt-v" style={{ background: '#191B22' }}><img src="/brand/wordmark-white.png" alt="ABET wordmark, white" /></div><div className="lt-b"><b>Wordmark on dark</b><V ok t="Official logowhite.png" /></div></div>
            <div className="logo-tile"><div className="lt-v" style={{ background: '#fff' }}><img src="/brand/mark.png" alt="ABET A mark" style={{ maxHeight: 64 }} /></div><div className="lt-b"><b>Bull-and-bear “A” mark</b><V ok t="Official favicon.png" /></div></div>
          </div>
          <div style={{ marginTop: 16 }} className="notice warn"><Icon name="alert" size={16} /><span>The website has no vector (SVG) logo. Please upload official SVG files in <b>Admin Panel → Brand assets</b>.</span></div>
        </Panel>
        <Panel icon="palette" title="Colour" className="bk-full">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div><h3 style={{ marginBottom: 8 }}>Primary</h3><div className="swatches"><SW hex="#AE1818" name="ABET Red" src="Website main colour" /><SW hex="#8C1313" name="Red, pressed" src="Website hover" /><SW hex="#BC202E" name="Logo Red" src="Logo file" /></div></div>
            <div><h3 style={{ marginBottom: 8 }}>Ink and neutrals</h3><div className="swatches"><SW hex="#191B22" name="Ink" src="Website main colour 2" /><SW hex="#231F20" name="Logo Ink" src="Logo file" /><SW hex="#333333" name="Body text" src="Website text" /><SW hex="#F8F9FA" name="Light surface" src="Website light" /></div></div>
            <div className="notice warn"><Icon name="alert" size={16} /><span>No official secondary colours were found on the website. Blue, amber and green in this app are for status only.</span></div>
          </div>
        </Panel>
        <Panel icon="type" title="Typography">
          <div className="type-spec">
            <div className="ts"><div className="k"><b>Space Grotesk</b>Headings <V ok t="Website" /></div><div style={{ fontFamily: 'var(--f-display)', fontSize: 28, fontWeight: 600, letterSpacing: '-.02em' }}>Trade with clarity</div></div>
            <div className="ts"><div className="k"><b>Poppins</b>Body <V ok t="Website" /></div><div style={{ fontSize: 15 }}>One MetaTrader 5 account for forex, gold, oil, indices and crypto CFDs.</div></div>
            <div className="ts"><div className="k"><b>Montserrat</b>Secondary <V ok t="Website footer" /></div><div style={{ fontFamily: 'Montserrat, var(--f-ui)', fontSize: 14, color: 'var(--text-2)' }}>Footer and small supporting text.</div></div>
          </div>
        </Panel>
        <Panel icon="book" title="Brand tone">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--text-2)' }}>
            <p><b style={{ color: 'var(--text)', fontWeight: 500 }}>Clear and plain.</b> Short sentences that explain trading terms simply.</p>
            <p><b style={{ color: 'var(--text)', fontWeight: 500 }}>Reassuring, never promising.</b> Safety, transparency and support. Never profits.</p>
            <p><b style={{ color: 'var(--text)', fontWeight: 500 }}>Global.</b> Plain English for clients in many countries.</p>
            <V ok={false} t="Summarised from website copy. Please confirm" />
          </div>
        </Panel>
        <Panel icon="at" title="Official accounts" className="bk-full">
          <div className="handles">{Object.entries(HANDLES).map(([k, v]) => <div key={k} className="handle"><span className="pl">{k === 'PIN' ? 'P' : k}</span><span>{v}</span></div>)}</div>
        </Panel>
        <Panel icon="shield" title="Mandatory legal text" className="bk-full">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="legal"><b>Risk warning (word for word from the website)</b><br />{RISK_FULL}</div>
            <div className="legal"><b>Registration</b><br />{REG_LINE} ABET does not offer advice, input, or recommendations regarding buying, holding, or selling of a CFD. ABET offers only execution-based services and is not a financial counselor.</div>
            <div className="legal"><b>Short warning for captions</b><br />{RISK_SHORT} <V ok={false} t="Written for Content OS. Needs compliance approval" /></div>
          </div>
        </Panel>
        <Panel icon="image" title="Website imagery" className="bk-full">
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <img src="/brand/mt5-devices.webp" alt="MetaTrader 5 on laptop, tablet and phones" style={{ width: 'min(360px,100%)', height: 'auto' }} />
            <div style={{ flex: 1, minWidth: 220, fontSize: 13, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 8 }}><b style={{ color: 'var(--text)', fontWeight: 500 }}>MT5 devices</b><p>For platform and onboarding content. The screens show MetaQuotes demo data.</p><V ok t="From abetglobal.com" /></div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
