import React, { useState } from "react";

export default function CategoryAccordion({ category, products, onSelect }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="accordion">
      <div className="accordion-header" onClick={() => setOpen(!open)}>
        <h3>{category}</h3>
        <span>{open ? "▲" : "▼"}</span>
      </div>
      <div className={`accordion-content ${open ? "open" : ""}`}>
        {products.map((product) => (
          <div
            key={product.id}
            className="accordion-item"
            onClick={() => onSelect(product)}
          >
            <span className="part-number">{product.partNumber}</span>
            <span className="description">{product.description}</span>
          </div>
        ))}
      </div>
    </div>
  );                                                                            
}