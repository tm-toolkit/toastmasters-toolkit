// Placeholder for tabs not yet ported from the vanilla toolkit.
// Each one gets replaced with its real port in a later step (see the migration plan).
export default function ComingSoonTab({ title, note }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      <p>{note || 'Being ported to React — coming in the next step.'}</p>
      <div className="maroon-line"></div>
    </div>
  );
}
