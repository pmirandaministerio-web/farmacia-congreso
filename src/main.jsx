import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const CATEGORIES = ["Perfumería", "Limpieza", "Higiene personal", "Medicamentos", "Bebes", "Otros"];
const PHONE_DISPLAY = "+54 381 632-2825";
const PHONE_TEL = "+543816322825";
const WHATSAPP_URL = "https://wa.me/5493816322825";
const MAPS_URL = "https://maps.app.goo.gl/p4TwLfQRTdFeTsoi6";
const ADDRESS = "Barrio Congreso, San Miguel de Tucumán, Argentina";
const API_BASE = import.meta.env.VITE_API_URL || "";
const IMAGE_PRESETS = {
  logo: { maxWidth: 520, maxHeight: 520, quality: 0.78 },
  heroImage: { maxWidth: 1400, maxHeight: 760, quality: 0.78 },
  product: { maxWidth: 820, maxHeight: 820, quality: 0.76 }
};

const initialStore = {
  logo: "",
  heroImage: "",
  products: []
};

async function fetchStore() {
  const response = await fetch(`${API_BASE}/api/store`);
  if (!response.ok) {
    throw new Error("No se pudo cargar el catálogo.");
  }
  return response.json();
}

async function persistStore(store) {
  const token = sessionStorage.getItem("farmacia-admin-token") || "";
  const response = await fetch(`${API_BASE}/api/store`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(store)
  });

  if (!response.ok) {
    throw new Error("No se pudo guardar.");
  }

  return response.json();
}

async function loginAdmin(credentials) {
  const response = await fetch(`${API_BASE}/api/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(credentials)
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "No se pudo iniciar sesión.");
  }
  return payload.token;
}

function money(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0
  }).format(number);
}

function Icon({ name }) {
  const icons = {
    search: "M21 21l-4.2-4.2m1.2-5.3a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z",
    phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.4 2.1L8 9.7a16 16 0 0 0 6.3 6.3l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z",
    message: "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.7 8.7 0 0 1-3.8-.9L3 21l1.8-4.8a8.5 8.5 0 1 1 16.2-4.7Z",
    map: "M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Zm0 0V3m6 18V6",
    cart: "M6 6h15l-2 8H8L6 3H3m6 18a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
    plus: "M12 5v14m-7-7h14",
    trash: "M3 6h18m-2 0-.8 14a2 2 0 0 1-2 2H7.8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z",
    upload: "M12 16V4m-5 5 5-5 5 5M4 20h16",
    close: "M18 6 6 18M6 6l12 12"
  };

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={icons[name]} />
    </svg>
  );
}

function ImageBox({ src, alt, compact = false }) {
  if (!src) {
    return (
      <div className={`image-empty ${compact ? "compact" : ""}`}>
        <Icon name="upload" />
        <span>Sin imagen</span>
      </div>
    );
  }
  return <img className={`product-image ${compact ? "compact" : ""}`} src={src} alt={alt} />;
}

function App() {
  const [store, setStore] = useState(initialStore);
  const [loadState, setLoadState] = useState("Cargando catálogo...");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");
  const [cart, setCart] = useState([]);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    fetchStore()
      .then((nextStore) => {
        setStore({ ...initialStore, ...nextStore });
        setLoadState("");
      })
      .catch(() => setLoadState("No se pudo cargar el catálogo. Revisá que el servidor esté activo."));
  }, []);

  function saveStore(next) {
    setStore(next);
    return persistStore(next)
      .then((savedStore) => setStore({ ...initialStore, ...savedStore }))
      .catch((error) => {
        alert("No se pudo guardar. Revisá la conexión con el servidor o probá optimizar las imágenes.");
        throw error;
      });
  }

  const filteredProducts = useMemo(() => {
    return store.products.filter((product) => {
      const matchesQuery = product.name.toLowerCase().includes(query.toLowerCase().trim());
      const matchesCategory = category === "Todas" || product.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [store.products, query, category]);

  const offers = store.products.filter((product) => product.offer);
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0), 0);

  function addToCart(product) {
    if (product.stock !== "Disponible") return;
    setCart((items) => [...items, product]);
  }

  function removeFromCart(index) {
    setCart((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  function clearCart() {
    setCart([]);
  }

  function checkout() {
    const lines = cart.map((item) => `- ${item.name} - ${money(item.price)}`);
    const text = `Hola, quiero hacer un pedido:\n\n${lines.join("\n")}\n\nTotal: ${money(total)}`;
    window.open(`${WHATSAPP_URL}?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <div className="top-ticker" aria-label="Informacion de envios">
        <div className="ticker-track">
          <span>Entregas gratis con monto minimo de compra segun la zona. Hacemos envios a domicilio.</span>
          <span aria-hidden="true">Entregas gratis con monto minimo de compra segun la zona. Hacemos envios a domicilio.</span>
        </div>
      </div>

      <header className="site-header">
        <div className="header-inner">
          <div className="brand">
            <div className="logo-wrap">
              {store.logo ? <img src={store.logo} alt="Logo Farmacia B° Congreso" /> : <span>FC</span>}
            </div>
            <div>
              <h1>Farmacia B° Congreso</h1>
              <p>{ADDRESS}</p>
            </div>
          </div>
          <nav className="quick-actions" aria-label="Contacto">
            <a className="icon-button" href={`tel:${PHONE_TEL}`} title="Llamar">
              <Icon name="phone" />
              <span>Llamar</span>
            </a>
            <a className="icon-button" href={WHATSAPP_URL} target="_blank" rel="noreferrer" title="WhatsApp">
              <Icon name="message" />
              <span>WhatsApp</span>
            </a>
            <a className="icon-button" href={MAPS_URL} target="_blank" rel="noreferrer" title="Maps">
              <Icon name="map" />
              <span>Maps</span>
            </a>
            <button className="admin-link" type="button" onClick={() => setAdminOpen(true)}>
              Admin
            </button>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-media">
            {store.heroImage ? <img src={store.heroImage} alt="Farmacia B° Congreso" /> : <div className="hero-empty">Cargá una imagen desde Admin</div>}
          </div>
          <div className="hero-copy">
            <p>Farmacia B° Congreso</p>
            <h2>Tu farmacia de confianza en Barrio Congreso</h2>
            <div className="hero-actions">
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="primary-button">
                <Icon name="message" />
                Pedir por WhatsApp
              </a>
              <a href={MAPS_URL} target="_blank" rel="noreferrer" className="secondary-button">
                <Icon name="map" />
                Cómo llegar
              </a>
            </div>
          </div>
        </section>

        <section className="shop-layout">
          <div className="catalog">
            {loadState && <div className="status-banner">{loadState}</div>}
            <div className="section-head">
              <div>
                <p>Catálogo</p>
                <h2>Productos disponibles</h2>
              </div>
              <div className="search-box">
                <Icon name="search" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto" />
              </div>
            </div>

            <div className="filters" aria-label="Categorías">
              {["Todas", ...CATEGORIES].map((item) => (
                <button key={item} type="button" className={category === item ? "active" : ""} onClick={() => setCategory(item)}>
                  {item}
                </button>
              ))}
            </div>

            {offers.length > 0 && (
              <section className="offers">
                <div className="section-head compact-head">
                  <div>
                    <p>Promociones</p>
                    <h2>Ofertas destacadas</h2>
                  </div>
                </div>
                <div className="product-grid">
                  {offers.map((product) => (
                    <ProductCard key={product.id} product={product} onAdd={addToCart} />
                  ))}
                </div>
              </section>
            )}

            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAdd={addToCart} />
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="empty-state">
                <h3>No hay productos cargados para esta búsqueda</h3>
                <p>Entrá al panel Admin para agregar productos con sus imágenes reales.</p>
              </div>
            )}
          </div>

          <aside className="cart-panel">
            <div className="cart-title">
              <div>
                <Icon name="cart" />
                <h2>Carrito</h2>
              </div>
              {cart.length > 0 && (
                <button className="clear-cart-button" type="button" onClick={clearCart}>
                  Vaciar
                </button>
              )}
            </div>
            {cart.length === 0 ? (
              <p className="muted">Agregá productos para preparar tu pedido.</p>
            ) : (
              <div className="cart-list">
                {cart.map((item, index) => (
                  <div className="cart-item" key={`${item.id}-${index}`}>
                    <span>{item.name}</span>
                    <strong>{money(item.price)}</strong>
                    <button type="button" onClick={() => removeFromCart(index)} title="Quitar">
                      <Icon name="close" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="cart-total">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
            <button className="checkout-button" type="button" disabled={cart.length === 0} onClick={checkout}>
              <Icon name="message" />
              Finalizar compra por WhatsApp
            </button>
          </aside>
        </section>
      </main>

      <footer className="site-footer">
        <div>
          <h2>Farmacia B° Congreso</h2>
          <p>{ADDRESS}</p>
          <p>{PHONE_DISPLAY}</p>
        </div>
        <div className="footer-notes">
          <span>Aceptamos todos los medios de pago</span>
          <span>Trabajamos con obras sociales</span>
          <span>Hacemos envios a domicilio</span>
        </div>
        <div className="footer-actions">
          <a href={WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp</a>
          <a href={MAPS_URL} target="_blank" rel="noreferrer">Maps</a>
        </div>
      </footer>

      {adminOpen && <AdminPanel store={store} saveStore={saveStore} onClose={() => setAdminOpen(false)} />}
    </>
  );
}

function ProductCard({ product, onAdd }) {
  const outOfStock = product.stock !== "Disponible";
  return (
    <article className="product-card">
      {product.offer && <span className="offer-badge">OFERTA</span>}
      <ImageBox src={product.image} alt={product.name} />
      <div className="product-info">
        <span className="category-chip">{product.category}</span>
        <h3>{product.name}</h3>
        <div className="product-meta">
          <strong>{money(product.price)}</strong>
          <span className={outOfStock ? "stock off" : "stock"}>{product.stock}</span>
        </div>
        <button type="button" disabled={outOfStock} onClick={() => onAdd(product)}>
          <Icon name="plus" />
          Agregar al carrito
        </button>
      </div>
    </article>
  );
}

function AdminPanel({ store, saveStore, onClose }) {
  const [loggedIn, setLoggedIn] = useState(Boolean(sessionStorage.getItem("farmacia-admin-token")));
  const [login, setLogin] = useState({ user: "", pass: "" });
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyProduct());
  const [message, setMessage] = useState("");

  function handleLogin(event) {
    event.preventDefault();
    loginAdmin(login)
      .then((token) => {
        sessionStorage.setItem("farmacia-admin-token", token);
        setLoggedIn(true);
        setMessage("");
      })
      .catch((error) => setMessage(error.message));
  }

  async function updateAsset(key, file) {
    if (!file) return;
    setMessage("Optimizando imagen...");
    try {
      const image = await imageToDataUrl(file, IMAGE_PRESETS[key]);
      await saveStore({ ...store, [key]: image });
      setMessage("Imagen guardada.");
    } catch {
      setMessage("No se pudo guardar la imagen.");
    }
  }

  async function updateProductImage(file) {
    if (!file) return;
    setMessage("Optimizando imagen...");
    try {
      const image = await imageToDataUrl(file, IMAGE_PRESETS.product);
      setForm((current) => ({ ...current, image }));
      setMessage("Imagen lista para guardar.");
    } catch {
      setMessage("No se pudo procesar la imagen.");
    }
  }

  async function optimizeCurrentImages() {
    setMessage("Optimizando imágenes cargadas...");
    try {
      const optimizedStore = await optimizeStoreImages(store);
      await saveStore(optimizedStore);
      setMessage("Imágenes optimizadas y guardadas.");
    } catch {
      setMessage("No se pudieron optimizar las imágenes.");
    }
  }

  function submitProduct(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.price || !form.category || !form.image) {
      setMessage("Completá nombre, precio, categoría e imagen.");
      return;
    }

    const product = { ...form, name: form.name.trim(), price: Number(form.price) };
    const nextProducts = editingId
      ? store.products.map((item) => (item.id === editingId ? { ...product, id: editingId } : item))
      : [{ ...product, id: crypto.randomUUID() }, ...store.products];

    saveStore({ ...store, products: nextProducts });
    setForm(emptyProduct());
    setEditingId(null);
    setMessage(editingId ? "Producto actualizado." : "Producto agregado.");
  }

  function editProduct(product) {
    setEditingId(product.id);
    setForm(product);
    setMessage("");
  }

  function deleteProduct(id) {
    saveStore({ ...store, products: store.products.filter((product) => product.id !== id) });
    if (editingId === id) {
      setEditingId(null);
      setForm(emptyProduct());
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Panel Admin">
      <div className="admin-panel">
        <div className="admin-top">
          <div>
            <p>Panel interno</p>
            <h2>Administración</h2>
          </div>
          <button className="round-button" type="button" onClick={onClose} title="Cerrar">
            <Icon name="close" />
          </button>
        </div>

        {!loggedIn ? (
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              Usuario
              <input value={login.user} onChange={(event) => setLogin({ ...login, user: event.target.value })} autoFocus />
            </label>
            <label>
              Contraseña
              <input type="password" value={login.pass} onChange={(event) => setLogin({ ...login, pass: event.target.value })} />
            </label>
            <button className="primary-button full" type="submit">Entrar</button>
            {message && <p className="form-message error">{message}</p>}
          </form>
        ) : (
          <div className="admin-grid">
            <section className="admin-card">
              <h3>Imagen principal y logo</h3>
              <button className="optimize-button" type="button" onClick={optimizeCurrentImages}>
                Optimizar imágenes actuales
              </button>
              <div className="asset-grid">
                <label className="upload-card">
                  <ImageBox src={store.logo} alt="Logo actual" compact />
                  <span>Cambiar logo</span>
                  <input type="file" accept="image/*" onChange={(event) => updateAsset("logo", event.target.files[0])} />
                </label>
                <label className="upload-card">
                  <ImageBox src={store.heroImage} alt="Imagen principal actual" compact />
                  <span>Cambiar hero</span>
                  <input type="file" accept="image/*" onChange={(event) => updateAsset("heroImage", event.target.files[0])} />
                </label>
              </div>
            </section>

            <section className="admin-card">
              <h3>{editingId ? "Editar producto" : "Agregar producto"}</h3>
              <form className="product-form" onSubmit={submitProduct}>
                <label className="upload-card wide">
                  <ImageBox src={form.image} alt="Vista previa del producto" compact />
                  <span>Subir imagen del producto</span>
                  <input type="file" accept="image/*" onChange={(event) => updateProductImage(event.target.files[0])} />
                </label>
                <label>
                  Nombre
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                </label>
                <label>
                  Precio
                  <input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} />
                </label>
                <label>
                  Categoría
                  <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                    {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  Stock
                  <select value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })}>
                    <option>Disponible</option>
                    <option>Sin stock</option>
                  </select>
                </label>
                <label className="check-row">
                  <input type="checkbox" checked={form.offer} onChange={(event) => setForm({ ...form, offer: event.target.checked })} />
                  Marcar como Oferta
                </label>
                <div className="form-actions">
                  <button className="primary-button" type="submit">{editingId ? "Guardar cambios" : "Agregar producto"}</button>
                  {editingId && (
                    <button type="button" className="secondary-button" onClick={() => { setEditingId(null); setForm(emptyProduct()); }}>
                      Cancelar
                    </button>
                  )}
                </div>
                {message && <p className={`form-message ${message.includes("incorrect") || message.includes("Complet") ? "error" : ""}`}>{message}</p>}
              </form>
            </section>

            <section className="admin-card product-admin-list">
              <h3>Productos cargados</h3>
              {store.products.length === 0 ? (
                <p className="muted">Todavía no hay productos.</p>
              ) : (
                store.products.map((product) => (
                  <div className="admin-product" key={product.id}>
                    <ImageBox src={product.image} alt={product.name} compact />
                    <div>
                      <strong>{product.name}</strong>
                      <span>{money(product.price)} · {product.category} · {product.stock}</span>
                      {product.offer && <em>OFERTA</em>}
                    </div>
                    <button type="button" onClick={() => editProduct(product)} title="Editar">
                      <Icon name="edit" />
                    </button>
                    <button type="button" onClick={() => deleteProduct(product.id)} title="Eliminar">
                      <Icon name="trash" />
                    </button>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function emptyProduct() {
  return {
    name: "",
    price: "",
    category: CATEGORIES[0],
    stock: "Disponible",
    offer: false,
    image: ""
  };
}

function imageToDataUrl(file, preset = IMAGE_PRESETS.product) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      compressDataUrl(reader.result, preset).then(resolve).catch(reject);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function compressDataUrl(dataUrl, preset = IMAGE_PRESETS.product) {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, preset.maxWidth / image.width, preset.maxHeight / image.height);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      const compressed = canvas.toDataURL("image/jpeg", preset.quality);
      resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

async function optimizeStoreImages(store) {
  const products = await Promise.all(
    store.products.map(async (product) => ({
      ...product,
      image: await compressDataUrl(product.image, IMAGE_PRESETS.product)
    }))
  );

  return {
    ...store,
    logo: await compressDataUrl(store.logo, IMAGE_PRESETS.logo),
    heroImage: await compressDataUrl(store.heroImage, IMAGE_PRESETS.heroImage),
    products
  };
}

createRoot(document.getElementById("root")).render(<App />);
