<!-- Veridict banner -->
<div align="left">
  <a href="https://tarot.hildenmedia.se" target="_blank">
    <img
      height="220"
      src="https://raw.githubusercontent.com/Hilden202/HildenMedia/main/images/veridict-banner.png"
      alt="Veridict – Analyzes websites"
    />
  </a>
</div>

# Veridict Frontend

🌐 Live site: https://veridict.hildenmedia.se

---

Veridict is an AI-powered platform that analyzes and ranks websites based on **actual quality**, not popularity.

This repository contains the **public frontend** for Veridict, built with SvelteKit and deployed via GitHub Pages.

---

## 🧠 What is Veridict?

Most platforms rank content based on:
- SEO
- backlinks
- traffic

Veridict does something different.

It evaluates websites based on:
- relevance to intent
- practical value
- clarity and structure
- signal vs noise

The goal is simple:

> Help users find what is actually useful — not what is most visible.

---

## ⚙️ How it works

1. Enter a website URL  
2. The frontend sends a request to the Veridict API  
3. The API:
   - fetches the content
   - analyzes it using AI
   - stores the result  
4. The result is returned and displayed  

Subsequent requests reuse stored data to avoid unnecessary AI calls.

---

## 🧪 Tech Stack

- **SvelteKit** – frontend framework  
- **Vite** – build tool  
- **GitHub Pages** – hosting  
- **Render** – backend hosting (API)  

---

## 🌐 Environment Configuration

The frontend uses environment variables for API communication.

### Local development

Create a `.env` file in the `frontend` folder:

```
VITE_API_BASE_URL=https://localhost:7032
```

### Production

Set this in GitHub Secrets:

```
VITE_API_BASE_URL=https://veridict-53fa.onrender.com
```

---

## 🚀 Development

Install dependencies:

```
npm install
```

Run locally:

```
npm run dev
```

Build:

```
npm run build
```

---

## 📦 Deployment

This frontend is automatically deployed via GitHub Actions to GitHub Pages.

On each push:
- the app is built  
- environment variables are injected  
- the site is deployed  

---

## 🧭 Project Philosophy

This project is built with a focus on:

- clarity over complexity  
- real functionality over demos  
- iterative development  
- AI as a tool — not a crutch  

---

## 🔮 Status

Veridict is currently in an early stage but already supports:

- URL analysis  
- AI-based evaluation  
- persistent storage  
- caching and reuse logic  

---

## 👤 Author

Built by **Hilden Media**  
_"Teknik med själ"_

---

## ⚠️ Note

This repository contains only the **frontend**.

The backend (API, database, AI logic) is hosted separately.
