{
  description = "Meta Bugs addon flake";
  inputs = { nixpkgs.url = "github:nixos/nixpkgs"; };

  outputs = { self, nixpkgs }:
  let
    overlay = final: prev: {
      meta-bugs = with { inherit (prev) stdenv; inherit (final) zip; };
        stdenv.mkDerivation {
          pname = "meta-bugs";
          version = "0.2"; # TODO: extract from manifest file.
          src = ./.;
          buildInputs = [ zip ];
          buildPhase = ''
            mkdir $out
            zip -r -FS $out/meta-bugs.zip * \
              --exclude '*.git' \
              --exclude '*.nix' \
              --exclude '*.lock' \
              --exclude '.gitignore' \
              --exclude 'example-01.png'
          '';
        };
    };
    pkgs = system: import nixpkgs { inherit system; overlays = [ overlay ]; };
  in {
    overlays.default = overlay;
    packages.x86_64-linux.meta-bugs = (pkgs "x86_64-linux").meta-bugs;
    packages.x86_64-linux.default = self.packages.x86_64-linux.meta-bugs;
  };
}
