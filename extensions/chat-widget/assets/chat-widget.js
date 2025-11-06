// chat-widget.js — Mobile-friendly FINAL
// - Bottom-sheet layout on mobile (≤768px)
// - Safe-area insets, body scroll lock, keyboard-aware scrolling
// - Send button inside the input (unchanged behavior)

console.log("🚀 Chat widget v7 (mobile-final) loaded");
if (window.__AIW_INIT__) { console.warn("AI widget already initialized — skipping."); throw new Error("AIW_DUP_INIT"); }
window.__AIW_INIT__ = true;

class SimpleAIChatWidget {
  constructor() {
    this.isOpen = false;
    this.sessionId = this.generateSessionId();
    this.apiUrl = "http://localhost:60308/api/chat"; // ← set prod URL

    const dataEl = document.getElementById("ai-chat-data");
    if (!dataEl) return console.error("❌ ai-chat-data missing");

    this.shop = dataEl.dataset.shop || "";
    this.settings = {
      title: dataEl.dataset.title || "Chat Support",
      primaryColor: dataEl.dataset.primaryColor || "#2563EB",

      // Optional owner-configured messages / contacts:
      returnMsg: dataEl.dataset.returnMsg || "",
      shipMsg: dataEl.dataset.shipMsg || "",
      supportPhone: dataEl.dataset.supportPhone || "",
      supportEmail: dataEl.dataset.supportEmail || "",
      supportHours: dataEl.dataset.supportHours || "",
    };

    this.state = { mode: null, need: null, ctx: {} };

    this.createWidget();
    this.bindEvents();
  }

  // --- helpers
  isMobile() { return window.matchMedia("(max-width: 768px)").matches; }
  safe(val) { return `calc(${val} + env(safe-area-inset-bottom, 0px))`; }
  messagesEl(){ return document.getElementById("aiw-messages"); }
  cleanOrder(id){ return (id||"").replace(/[^0-9A-Za-z]/g,"").toUpperCase(); }
  generateSessionId(){ return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`; }

  scrollToBottom() {
    const m = this.messagesEl();
    if (m) m.scrollTop = m.scrollHeight;
  }

  // --- UI
  createWidget() {
    const p = this.settings.primaryColor;

    // Launcher
    const launcher = document.createElement("button");
    launcher.id = "aiw-launcher";
    launcher.setAttribute("aria-label", "Open support chat");
    Object.assign(launcher.style, {
      position: "fixed",
      right: "16px",
      bottom: this.safe("16px"),
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      background: p,
      border: "none",
      boxShadow: "0 14px 30px rgba(0,0,0,.18)",
      cursor: "pointer",
      zIndex: "2147483000",
      display: "grid",
      placeItems: "center"
    });
    launcher.innerHTML = this.paperPlaneSVG("#fff");

    // Window (desktop defaults; adjusted in applyResponsive())
    const win = document.createElement("div");
    win.id = "aiw-window";
    Object.assign(win.style, {
      position: "fixed",
      right: "20px",
      bottom: "86px",
      width: "392px",
      height: "580px",
      background: "#fff",
      color: "#0f172a",
      borderRadius: "20px",
      boxShadow: "0 20px 50px rgba(15,23,42,.22)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      zIndex: "2147483000",
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      opacity: "0",
      transform: "translateY(10px)",
      pointerEvents: "none",
      visibility: "hidden",
      transition: "opacity 200ms ease, transform 200ms ease"
    });

    // Header
    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 16px",
      background: "#fff",
      borderBottom: "1px solid #e5e7eb"
    });

    const headLeft = document.createElement("div");
    Object.assign(headLeft.style, { display: "flex", alignItems: "center", gap: "10px" });

    const avatar = document.createElement("div");
    Object.assign(avatar.style, {
      width: "28px",
      height: "28px",
      borderRadius: "9999px",
      background: "#F4B400",
      display: "grid",
      placeItems: "center",
      flexShrink: "0"
    });
    avatar.innerHTML = this.botIconFace("#111");

    const title = document.createElement("div");
    title.innerHTML = `<div style="font-weight:800;font-size:14px">${this.settings.title}</div>
                       <div style="font-size:12px;color:#64748b">Online</div>`;

    const closeBtn = document.createElement("button");
    closeBtn.id = "aiw-close";
    closeBtn.setAttribute("aria-label","Close chat");
    closeBtn.innerHTML = "&times;";
    Object.assign(closeBtn.style,{
      width:"28px",height:"28px",borderRadius:"8px",background:"#f8fafc",
      border:"1px solid #e2e8f0",color:"#0f172a",fontSize:"20px",lineHeight:"24px",cursor:"pointer"
    });

    headLeft.appendChild(avatar); headLeft.appendChild(title);
    header.appendChild(headLeft); header.appendChild(closeBtn);

    // Messages
    const messages = document.createElement("div");
    messages.id = "aiw-messages";
    Object.assign(messages.style, {
      flex: "1",
      padding: "16px",
      overflowY: "auto",
      background: "#fff",
      WebkitOverflowScrolling: "touch" // smoother iOS scroll
    });

    // Intro + actions
    this.addAssistantBubble(messages,
      "Hi! I can help with tracking, returns & exchanges, discounts, shipping & delivery, or connect you to support."
    );
    this.renderMainActions(messages);

    // Composer (send button inside)
    const composer = document.createElement("div");
    Object.assign(composer.style, {
      borderTop: "1px solid #eef2f7",
      background: "#fff",
      padding: "10px 12px",
      paddingBottom: this.isMobile() ? this.safe("10px") : "10px"
    });

    const inputWrap = document.createElement("div");
    Object.assign(inputWrap.style, { position: "relative" });

    const input = document.createElement("input");
    input.id = "aiw-input";
    input.type = "text";
    input.placeholder = "Type a message…";
    input.setAttribute("aria-label", "Type your message");
    Object.assign(input.style, {
      width: "100%",
      padding: "14px 56px 14px 14px",
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: "9999px",
      outline: "none",
      fontSize: "16px" // bigger on mobile for accessibility
    });

    const sendFab = document.createElement("button");
    sendFab.id = "aiw-send";
    sendFab.setAttribute("aria-label","Send message");
    Object.assign(sendFab.style,{
      position:"absolute",
      right:"8px",
      top:"50%",
      transform:"translateY(-50%)",
      width:"44px",
      height:"44px",
      borderRadius:"50%",
      background:this.settings.primaryColor,
      border:"none",
      display:"grid",
      placeItems:"center",
      boxShadow:"0 6px 16px rgba(37,99,235,.25)",
      cursor:"pointer"
    });
    sendFab.innerHTML = this.paperPlaneSVG("#fff");

    // Micro interaction
    sendFab.addEventListener("mousedown",()=>sendFab.style.transform="translateY(-50%) scale(.96)");
    const resetSend = ()=>sendFab.style.transform="translateY(-50%) scale(1)";
    sendFab.addEventListener("mouseup", resetSend);
    sendFab.addEventListener("mouseleave", resetSend);

    inputWrap.appendChild(input); inputWrap.appendChild(sendFab);
    composer.appendChild(inputWrap);

    // Footer "Powered by"
    const footer = document.createElement("div");
    footer.id = "aiw-powered";
    Object.assign(footer.style,{
      fontSize:"12px", color:"#8e9bae", textAlign:"center",
      padding: this.isMobile() ? this.safe("8px") : "8px",
      borderTop:"1px solid #eef2f7", background:"#fff"
    });
    footer.innerHTML = `Powered by <a href="https://gleura.ai" target="_blank" rel="noopener noreferrer" style="color:${this.settings.primaryColor};text-decoration:none;font-weight:600">Gleura AI</a>`;

    // Assemble
    win.appendChild(header);
    win.appendChild(messages);
    win.appendChild(composer);
    win.appendChild(footer);

    document.body.appendChild(launcher);
    document.body.appendChild(win);

    this.launcherEl = launcher;
    this.windowEl = win;

    // Apply responsive sizing now & on resize
    const apply = ()=>this.applyResponsive();
    apply();
    window.addEventListener("resize", apply, { passive:true });
  }

  applyResponsive() {
    const win = this.windowEl;
    const isM = this.isMobile();
    if (!win) return;

    if (isM) {
      // Bottom sheet: full width with margins, taller, rounded top
      win.style.left = "8px";
      win.style.right = "8px";
      win.style.width = "auto";
      win.style.bottom = this.safe("8px");
      win.style.top = "12vh"; // sheet height ≈ 88vh
      win.style.height = "auto";
      win.style.borderRadius = "16px";
    } else {
      win.style.left = "auto";
      win.style.right = "20px";
      win.style.bottom = "86px";
      win.style.top = "auto";
      win.style.width = "392px";
      win.style.height = "580px";
      win.style.borderRadius = "20px";
    }

    // Adjust launcher bottom for safe-area
    if (this.launcherEl) {
      this.launcherEl.style.bottom = this.safe(isM ? "14px" : "16px");
      this.launcherEl.style.right = isM ? "14px" : "16px";
    }
  }

  // --- Actions menu
  renderMainActions(container) {
    const wrap = document.createElement("div");
    Object.assign(wrap.style,{ display:"flex", flexWrap:"wrap", gap:"8px", margin:"10px 0 12px 44px" });

    const make = (label, onClick) => {
      const b = document.createElement("button");
      b.textContent = label;
      Object.assign(b.style,{
        padding:"10px 14px",
        borderRadius:"9999px",
        background:"#fff",
        border:"1px solid #e5e7eb",
        fontSize:"14px",
        cursor:"pointer",
        lineHeight:"1"
      });
      b.onclick = onClick; wrap.appendChild(b);
    };

    make("Track Order", ()=>this.startTrack());
    make("Return / Exchange", ()=>this.showOwnerMsg(this.settings.returnMsg || "You can start a return or exchange by emailing support with your order number."));
    make("Discounts", ()=>this.apiCall({ action:"discounts" }, "SAVE10 — 10% off<br>HOLIDAY20 — 20% off $50+<br>NEWBIE15 — 15% off"));
    make("Shipping & Delivery", ()=>this.showOwnerMsg(this.settings.shipMsg || "Orders ship within 1–2 business days; standard delivery 3–5 business days."));
    make("Connect to Support", ()=>this.showOwnerMsg(`Phone: ${this.settings.supportPhone || "—"}<br>Email: ${this.settings.supportEmail || "—"}<br>Hours: ${this.settings.supportHours || "—"}`));

    container.appendChild(wrap);
    this.scrollToBottom();
  }

  showOwnerMsg(html) {
    this.addAssistantBubble(this.messagesEl(), html);
    // Offer top-level options again
    this.addFollowUps([
      { label:"Track Order", onClick:()=>this.startTrack() },
      { label:"Discounts", onClick:()=>this.apiCall({ action:"discounts" },"…") },
      { label:"Shipping & Delivery", onClick:()=>this.showOwnerMsg(this.settings.shipMsg || "…") },
      { label:"Connect to Support", onClick:()=>this.showOwnerMsg(`Phone: ${this.settings.supportPhone || "—"}<br>Email: ${this.settings.supportEmail || "—"}<br>Hours: ${this.settings.supportHours || "—"}`) },
    ]);
  }

  addFollowUps(list) {
    const container = this.messagesEl();
    const row = document.createElement("div");
    Object.assign(row.style,{ display:"flex", flexWrap:"wrap", gap:"8px", margin:"8px 0 0 44px" });

    list.forEach(({ label, onClick }) => {
      const b = document.createElement("button");
      b.textContent = label;
      Object.assign(b.style,{
        padding:"8px 12px",
        borderRadius:"9999px",
        background:"#fff",
        border:"1px solid #e5e7eb",
        fontSize:"13px",
        cursor:"pointer",
        lineHeight:"1"
      });
      b.onclick = onClick;
      row.appendChild(b);
    });

    container.appendChild(row);
    this.scrollToBottom();
  }

  addCrumb(stepText) {
    const el = document.createElement("div");
    Object.assign(el.style,{ margin:"6px 0 4px 44px", fontSize:"11px", color:"#64748b" });
    el.textContent = stepText;
    this.messagesEl().appendChild(el);
  }

  // ---- Track flow
  startTrack() {
    this.state = { mode:"track", need:"order", ctx:{} };
    this.addCrumb("1/2 • Order");
    this.addAssistantBubble(this.messagesEl(), "Please share your order number:");
  }

  async sendMessage() {
    const input = document.getElementById("aiw-input");
    const text = (input?.value || "").trim();
    if (!text) return;

    this.addUserBubble(this.messagesEl(), text);
    input.value = "";

    // Intentless → only track flow + API scripted routes
    const { mode, need, ctx } = this.state;

    if (mode === "track") {
      if (need === "order") {
        ctx.orderNumber = this.cleanOrder(text);
        this.state.need = "phone";
        this.addCrumb("2/2 • Contact");
        this.addAssistantBubble(this.messagesEl(), "Now share the phone number used at shipping:");
        return;
      }
      if (need === "phone") {
        const digits = text.replace(/\D/g, "");
        if (digits.length !== 10) {
          this.addAssistantBubble(this.messagesEl(), "Please provide a 10-digit phone number.");
          return;
        }
        ctx.phone = digits.slice(-10);
        this.state = { mode:null, need:null, ctx:{} };
        await this.apiCall(
          { action:"track_order", orderNumber: ctx.orderNumber, phoneNumber: ctx.phone },
          "Order Date: —<br>Order No: —<br>Order Value: —<br>Status: —<br>Shipping Address: —<br>Tracking: —"
        );
        this.addFollowUps([
          { label:"Track another order", onClick:()=>this.startTrack() },
          { label:"Connect to Support", onClick:()=>this.showOwnerMsg(`Phone: ${this.settings.supportPhone || "—"}<br>Email: ${this.settings.supportEmail || "—"}<br>Hours: ${this.settings.supportHours || "—"}`) }
        ]);
        return;
      }
    }

    // Default go to API scripted help (no AI)
    await this.apiCall({ message: text }, "I can help with Track Order, Return/Exchange, Discounts, Shipping & Delivery, or Connect to Support.");
  }

  // --- API + bubbles
  async apiCall(payload, fallbackHtml) {
    const stop = this.showTyping(this.messagesEl());
    try {
      const res = await fetch(this.apiUrl, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ ...payload, sessionId: this.sessionId, shop: this.shop })
      });
      let data = {}; try { data = await res.json(); } catch {}
      this.addAssistantBubble(this.messagesEl(), data.response || fallbackHtml);
    } catch {
      this.addAssistantBubble(this.messagesEl(), "Error contacting support.");
    } finally { stop(); }
  }

  addAssistantBubble(container, html) {
    const row = document.createElement("div");
    Object.assign(row.style,{ display:"flex", gap:"10px", margin:"12px 0", alignItems:"flex-start" });

    const avatar = document.createElement("div");
    Object.assign(avatar.style,{
      width:"28px", height:"28px", borderRadius:"9999px", background:"#F4B400", display:"grid", placeItems:"center", flexShrink:"0"
    });
    avatar.innerHTML = this.botIconFace("#111");

    const bubble = document.createElement("div");
    Object.assign(bubble.style,{
      background:"#F8FAFC",
      color:"#0f172a",
      padding:"12px 14px",
      borderRadius:"14px",
      border:"1px solid #E5E7EB",
      maxWidth:"78%",
      fontSize:"15px",
      lineHeight:"1.5",
      wordBreak:"break-word"
    });
    bubble.innerHTML = html;

    row.appendChild(avatar); row.appendChild(bubble);
    container.appendChild(row);
    this.scrollToBottom();
  }

  addUserBubble(container, text) {
    const row = document.createElement("div");
    Object.assign(row.style,{ display:"flex", justifyContent:"flex-end", margin:"10px 0" });
    const bubble = document.createElement("div");
    Object.assign(bubble.style,{
      background:"#FFFFFF", color:"#0f172a", padding:"12px 14px", borderRadius:"14px",
      border:"1px solid #e5e7eb", maxWidth:"78%", fontSize:"15px", lineHeight:"1.5", boxShadow:"0 1px 0 rgba(0,0,0,.02)"
    });
    bubble.textContent = text;
    row.appendChild(bubble);
    container.appendChild(row);
    this.scrollToBottom();
  }

  showTyping(container) {
    const row = document.createElement("div");
    Object.assign(row.style,{ display:"flex", gap:"10px", margin:"6px 0 12px", alignItems:"center" });
    const dot = document.createElement("div");
    Object.assign(dot.style,{
      background:"#F8FAFC", border:"1px solid #E5E7EB", padding:"8px 12px", borderRadius:"10px", fontSize:"12px", color:"#64748b"
    });
    dot.textContent = "typing…";
    row.appendChild(dot); container.appendChild(row); this.scrollToBottom();
    return ()=>row.remove();
  }

  // --- Events
  bindEvents() {
    this.launcherEl = document.getElementById("aiw-launcher");
    this.windowEl   = document.getElementById("aiw-window");

    this.launcherEl?.addEventListener("click", ()=>this.toggleChat());
    document.getElementById("aiw-close")?.addEventListener("click", ()=>this.closeChat());
    document.getElementById("aiw-send")?.addEventListener("click", ()=>this.sendMessage());
    const input = document.getElementById("aiw-input");
    input?.addEventListener("keypress",(e)=>{ if (e.key === "Enter") this.sendMessage(); });

    // Mobile keyboard handling: keep latest message in view
    input?.addEventListener("focus", ()=>setTimeout(()=>this.scrollToBottom(), 50));
  }

  lockBodyScroll() {
    // prevent background scroll on mobile
    this._prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    this._prevBodyPos = document.body.style.position;
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
  }
  unlockBodyScroll() {
    document.documentElement.style.overflow = this._prevOverflow || "";
    document.body.style.position = this._prevBodyPos || "";
    document.body.style.width = "";
  }

  toggleChat() {
    const win = this.windowEl; if (!win) return;
    const opening = win.style.visibility !== "visible";
    if (opening) {
      // hide launcher immediately
      if (this.launcherEl) this.launcherEl.style.display = "none";
      win.style.visibility = "visible";
      win.style.pointerEvents = "auto";
      win.style.opacity = "1";
      win.style.transform = "translateY(0)";
      if (this.isMobile()) this.lockBodyScroll();
      this.isOpen = true;
      setTimeout(()=>document.getElementById("aiw-input")?.focus(), 50);
    } else {
      this.closeChat();
    }
  }

  closeChat() {
    const win = this.windowEl; if (!win) return;
    win.style.opacity = "0";
    win.style.transform = "translateY(10px)";
    win.style.pointerEvents = "none";
    setTimeout(()=>{ win.style.visibility = "hidden"; }, 200);
    if (this.launcherEl) this.launcherEl.style.display = "grid";
    if (this.isMobile()) this.unlockBodyScroll();
    this.isOpen = false;
  }

  // --- SVG
  botIconFace(fill="#111"){
    return `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="${fill}"/>
      <circle cx="9" cy="11" r="1.2" fill="#F4B400"/>
      <circle cx="15" cy="11" r="1.2" fill="#F4B400"/>
      <path d="M9 14c.8 1 2.2 1 3 0" stroke="#F4B400" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    </svg>`;
  }
  paperPlaneSVG(stroke="#fff"){
    return `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M3 11.5l17-7-5.8 15.3-3.3-5.2-5.9-3.1zM10.7 14.6L19.7 4.5"
        fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
}

// Boot
(function init(){
  const run = ()=>new SimpleAIChatWidget();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once:true });
  } else {
    run();
  }
})();