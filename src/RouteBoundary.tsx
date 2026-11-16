import { Component } from "react";
import type { ReactNode } from "react";
export class RouteBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="landing-status" role="alert">
        <h1>Sayfa açılamadı</h1>
        <p>Bağlantını kontrol edip yeniden yükle.</p>
        <button
          className="button button--primary"
          onClick={() => location.reload()}
        >
          Yeniden yükle
        </button>
      </section>
    ) : (
      this.props.children
    );
  }
}
