"use client";

import Image from "next/image";
import styles from "./TopBar.module.css";

type Props = {
  showLiveLink?: boolean;
  showSubmit?: boolean;
  submitHref?: string;
};

export default function TopBar({
  showLiveLink = true,
  showSubmit = true,
  submitHref = "/submit",
}: Props) {
  const ytLive = "https://www.youtube.com/@ShihTZuz";

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <div className={styles.logoWrap}>
          <Image
            src="/brand/logo-badge.png"
            alt="ShihTZuz"
            width={44}
            height={44}
            style={{ borderRadius: 12 }}
            priority
          />
        </div>

        <div className={styles.brandText}>
          <div className={styles.title}>ShihTZuz</div>
          <div className={styles.sub}>Cuidados • Rotina • Diversão</div>
        </div>
      </div>

      <div className={styles.right}>
        {showLiveLink && (
          <a
            href={ytLive}
            target="_blank"
            rel="noreferrer"
            className={styles.liveBtn}
            title="Abrir canal no YouTube"
          >
            <span className={styles.dot} />
            Assistir Live
          </a>
        )}

        {showSubmit && (
          <a href={submitHref} className={styles.submitBtn}>
            Enviar foto
          </a>
        )}
      </div>
    </header>
  );
}