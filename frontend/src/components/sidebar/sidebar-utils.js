export function isNavItemActive(pathname, path) {
  const basePath = String(path || "").split("?")[0];
  if (basePath === "/" || basePath === "/admin/dashboard") {
    return pathname === "/" || pathname === "/admin/dashboard";
  }
  if (basePath === "/lead-provider/dashboard") {
    return pathname === "/lead-provider/dashboard";
  }
  if (basePath === "/leads") return pathname === "/leads";
  if (basePath === "/hr/dashboard")
    return pathname === "/hr/dashboard" || pathname === "/hr";
  if (basePath === "/team/sales-targets") {
    return pathname === "/team/sales-targets";
  }
  if (basePath === "/team") {
    return pathname === "/team";
  }
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function matchesQuery(text, query) {
  return text?.toLowerCase().includes(query);
}

function filterSectionItems(items, q, groupMatch) {
  if (groupMatch) return items;
  return items.filter((c) => matchesQuery(c.label, q));
}

export function filterNavItemsBySearch(items, query) {
  const q = query?.trim().toLowerCase();
  if (!q) return items;

  return items.reduce((acc, item) => {
    if (item.section) {
      return acc;
    }

    if (item.sections) {
      const groupMatch = matchesQuery(item.label, q);
      const sections = item.sections
        .map((section) => {
          const sectionMatch = matchesQuery(section.label, q);
          const filteredItems = filterSectionItems(
            section.items,
            q,
            groupMatch || sectionMatch,
          );
          if (groupMatch || sectionMatch || filteredItems.length) {
            return {
              ...section,
              items: groupMatch || sectionMatch ? section.items : filteredItems,
            };
          }
          return null;
        })
        .filter(Boolean);
      if (sections.length) {
        acc.push({ ...item, sections });
      }
      return acc;
    }

    if (item.children) {
      const groupMatch = matchesQuery(item.label, q);
      const filteredChildren = item.children.filter((c) =>
        matchesQuery(c.label, q),
      );
      if (groupMatch || filteredChildren.length) {
        acc.push({
          ...item,
          children: groupMatch ? item.children : filteredChildren,
        });
      }
      return acc;
    }

    if (matchesQuery(item.label, q)) {
      acc.push(item);
    }
    return acc;
  }, []);
}

export function injectSectionHeaders(items) {
  const result = [];
  let lastSection = null;

  for (const item of items) {
    if (item.section && item.section !== lastSection) {
      result.push({ type: "section", label: item.section });
      lastSection = item.section;
    }
    result.push(item);
  }

  return result;
}
