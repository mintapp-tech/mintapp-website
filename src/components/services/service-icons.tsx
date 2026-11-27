// One glyph per service, in the order the services are listed, drawn from the
// same simple shapes the site already uses. Shared by the homepage and /services.
export const SERVICE_ICONS = [
  <span key="web" className="block h-[13px] w-[19px] rounded-[3px] border-2 border-mint" />,
  <span key="app" className="relative block h-[15px] w-[19px] rounded-[3px] border-2 border-mint">
    <span className="absolute inset-y-0 start-[5px] block w-[2px] bg-mint" />
  </span>,
  <span key="mobile" className="block h-[19px] w-3 rounded-[4px] border-2 border-mint" />,
  <span key="design" className="block h-[14px] w-[14px] rotate-45 rounded-[4px] border-2 border-mint" />,
  <span key="systems" className="grid grid-cols-2 gap-[3px]">
    {[0, 1, 2, 3].map((i) => (
      <span key={i} className="block h-[8px] w-[8px] rounded-[2px] border-2 border-mint" />
    ))}
  </span>,
];
