import pkgJson from "../../../../../package.json" with { type: "json" };

const AppTitle = () => {
  return (
    <div className="flex gap-2">
      <p className="font-bold select-none">Hinekora</p>
      <div className="badge badge-soft badge-sm mt-0.5">v{pkgJson.version}</div>
    </div>
  );
};

export default AppTitle;
