import "../styles/auth.css";
import { SignInButton } from "@clerk/clerk-react";

const AuthPage = () => {
  return (
    <div className="auth-container">
      <div className="auth-left">
        <div className="auth-hero">
          <div className="brand-container">
            <span className="brand-name">Мессенджер</span>
          </div>

          <h1 className="hero-title">Пространство Для Общения</h1>

          <p className="hero-subtitle">
            Единая корпоративная платформа для защищенного обмена сообщениями в
            реальном времени со всем необходимым функционалом.
          </p>

          <div className="features-list">
            <div className="feature-item">
              <span className="feature-icon">💬</span>
              <span>Сообщения в реальном времени</span>
            </div>

            <div className="feature-item">
              <span className="feature-icon">🔒</span>
              <span>Данные защищены</span>
            </div>

            <div className="feature-item">
              <span className="feature-icon">📞</span>
              <span>Звонки в реальном времени</span>
            </div>
          </div>

          <SignInButton mode="modal">
            <button className="cta-button">
              Войти в Мессенджер
              <span className="button-arrow">→</span>
            </button>
          </SignInButton>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-image-container">
          <img
            src="/authimage.png"
            alt="Team collaboration"
            className="auth-image"
          />
          <div className="image-overlay"></div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
