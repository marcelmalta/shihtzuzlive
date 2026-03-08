import TopBar from "@/components/TopBar";
import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <TopBar showLiveLink showSubmit submitHref="/submit" />

      <section className={styles.hero}>
        <div className={styles.container}>
          <Image
            src="/brand/logo-horizontal.png"
            alt="ShihTzuz"
            width={720}
            height={180}
            className={styles.logo}
            priority
          />

          <h1 className={styles.title}>
            Seu Shih Tzu merece <br /> estar no mural!
          </h1>

          <p className={styles.subtitle}>
            Envie a foto do seu melhor amigo e veja ele aparecer ao vivo no mural mais fofo da internet.
          </p>

          <div className={styles.buttons}>
            <a href="/submit" className={styles.btnPrimary}>
              Enviar foto do meu Shih Tzu
            </a>

            <a href="/live" className={styles.btnSecondary}>
              Ver Mural Ao Vivo
            </a>

            <a 
              href="https://www.youtube.com/@ShihTZuz" 
              target="_blank" 
              rel="noreferrer"
              className={styles.btnSecondary}
            >
              Assistir no YouTube
            </a>
          </div>

          <p className={styles.info}>
            Troca automática a cada 7 segundos • Mais de 100 Shih Tzus já participaram
          </p>
        </div>
      </section>
    </>
  );
}